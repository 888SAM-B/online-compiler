import random
import secrets
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import FileResponse
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_user, get_current_user_optional, log_activity
from app.models import (
    AssessmentResponse,
    AttemptStartResponse,
    QuestionResponse,
    SaveAnswerRequest,
    AttemptSubmitRequest,
    AttemptSubmitResponse,
    CertificateResponse,
    CertificateVerifyResponse
)
from app.services.certificate_generator import generate_certificate_pdf
from app.services.email_service import send_certificate_email

router = APIRouter(prefix="/assessments", tags=["assessments"])

def serialize_assessment(assess: dict) -> dict:
    assess_copy = assess.copy()
    assess_copy["id"] = str(assess_copy["_id"])
    assess_copy.pop("_id", None)
    return assess_copy

async def check_and_auto_submit_session(session: dict, db) -> dict:
    # Auto-submits a timed-out session using saved answers
    attempt_id = session["attempt_id"]
    attempt = await db.assessment_attempts.find_one({"_id": attempt_id})
    if not attempt or attempt["status"] != "active":
        return attempt

    # Evaluate current answers
    assessment = await db.assessments.find_one({"_id": attempt["assessment_id"]})
    
    # Grade answers
    score = 0
    q_ids = [ObjectId(qid) for qid in attempt["question_order"]]
    db_questions = await db.assessment_questions.find({"_id": {"$in": q_ids}}).to_list(length=100)
    correct_map = {str(q["_id"]): q["correct_answer"] for q in db_questions}
    
    for ans in attempt.get("answers", []):
        q_id = ans["question_id"]
        if q_id in correct_map and ans["selected_answer"] == correct_map[q_id]:
            score += 1
            
    total_q = len(attempt["question_order"])
    percentage = round((score / total_q) * 100, 2) if total_q > 0 else 0.0
    
    # Determine badge
    badge = "failed"
    passed = False
    if percentage >= assessment["passing_percentage"]:
        passed = True
        if percentage >= assessment["badge_rules"].get("gold", 90):
            badge = "gold"
        elif percentage >= assessment["badge_rules"].get("silver", 75):
            badge = "silver"
        else:
            badge = "bronze"
            
    duration_taken = int((session["expires_at"] - attempt["started_at"]).total_seconds())

    # Update attempt
    await db.assessment_attempts.update_one(
        {"_id": attempt_id},
        {
            "$set": {
                "score": score,
                "percentage": percentage,
                "badge": badge,
                "passed": passed,
                "status": "timed_out",
                "submitted_at": session["expires_at"],
                "duration_taken_seconds": max(0, duration_taken)
            }
        }
    )

    # Delete active session
    await db.active_assessment_sessions.delete_one({"_id": session["_id"]})
    
    # Log failure/timeout activity
    user = await db.users.find_one({"_id": session["user_id"]})
    if user:
        await log_activity(
            user_id=str(user["_id"]),
            email=user["email"],
            action="ASSESSMENT_FAILED",
            details=f"Timed out on assessment: {assessment['title']}. Score: {percentage}%"
        )
        
    return await db.assessment_attempts.find_one({"_id": attempt_id})

@router.get("", response_model=List[AssessmentResponse])
async def get_active_assessments(db=Depends(get_db)):
    cursor = db.assessments.find({"active": True}).sort("title", 1)
    assessments = await cursor.to_list(length=100)
    return [serialize_assessment(a) for a in assessments]

@router.get("/history")
async def get_assessment_history(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    cursor = db.assessment_attempts.find({"user_id": ObjectId(current_user["id"])}).sort("submitted_at", -1)
    attempts = await cursor.to_list(length=100)
    
    serialized = []
    for att in attempts:
        assess = await db.assessments.find_one({"_id": att["assessment_id"]})
        serialized.append({
            "id": str(att["_id"]),
            "assessment_title": assess["title"] if assess else "Unknown Assessment",
            "score": att["score"],
            "percentage": att["percentage"],
            "badge": att["badge"],
            "passed": att["passed"],
            "status": att["status"],
            "submitted_at": att["submitted_at"],
            "duration_taken_seconds": att.get("duration_taken_seconds", 0)
        })
    return serialized

@router.get("/certificates", response_model=List[CertificateResponse])
async def get_user_certificates(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    cursor = db.certificates.find({"user_id": ObjectId(current_user["id"]), "revoked": False}).sort("issued_at", -1)
    certs = await cursor.to_list(length=100)
    
    serialized = []
    for c in certs:
        assess = await db.assessments.find_one({"_id": c["assessment_id"]})
        serialized.append(
            CertificateResponse(
                id=str(c["_id"]),
                certificate_id=c["certificate_id"],
                assessment_title=assess["title"] if assess else "Unknown Assessment",
                badge=c["badge"],
                percentage=c["percentage"],
                issued_at=c["issued_at"],
                attempt_id=str(c["attempt_id"]) if "attempt_id" in c else None
            )
        )
    return serialized

@router.get("/{id}", response_model=AssessmentResponse)
async def get_assessment(id: str, db=Depends(get_db)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assessment ID format")
    assess = await db.assessments.find_one({"_id": ObjectId(id), "active": True})
    if not assess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return serialize_assessment(assess)

@router.post("/{id}/start", response_model=AttemptStartResponse)
async def start_assessment(
    id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
        
    assessment = await db.assessments.find_one({"_id": ObjectId(id), "active": True})
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found or inactive")

    user_id = ObjectId(current_user["id"])

    # 1. Active Session Validation / Resume Support
    active_session = await db.active_assessment_sessions.find_one({"user_id": user_id})
    if active_session:
        # Check if active session has expired
        if datetime.utcnow() > active_session["expires_at"]:
            await check_and_auto_submit_session(active_session, db)
        else:
            # Active Session Lock: check if it's the SAME assessment
            if active_session["assessment_id"] == ObjectId(id):
                # Resume attempt! Retrieve attempt details
                attempt = await db.assessment_attempts.find_one({"_id": active_session["attempt_id"]})
                if attempt and attempt["status"] == "active":
                    # Fetch questions in their correct shuffled order
                    q_ids = [ObjectId(qid) for qid in attempt["question_order"]]
                    db_questions = await db.assessment_questions.find({"_id": {"$in": q_ids}}).to_list(length=100)
                    
                    # Sort to match question_order
                    q_map = {str(q["_id"]): q for q in db_questions}
                    sorted_questions = []
                    for qid in attempt["question_order"]:
                        if qid in q_map:
                            q_data = q_map[qid]
                            # Use stored shuffled options
                            options = attempt["shuffled_options"].get(qid, q_data["options"])
                            sorted_questions.append(
                                QuestionResponse(
                                    id=qid,
                                    question_text=q_data["question_text"],
                                    options=options
                                )
                            )
                            
                    await log_activity(
                        user_id=current_user["id"],
                        email=current_user["email"],
                        action="ASSESSMENT_RESUMED",
                        details=f"Resumed active assessment: {assessment['title']}"
                    )
                    
                    return AttemptStartResponse(
                        attempt_id=str(attempt["_id"]),
                        assessment_title=assessment["title"],
                        duration_minutes=assessment["duration_minutes"],
                        expires_at=active_session["expires_at"],
                        questions=sorted_questions,
                        answers=attempt.get("answers", [])
                    )
            
            # Locked to another assessment
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have another active assessment session in progress. Please complete or wait for it to expire first."
            )

    # 2. Max Attempts Validation
    attempts_count = await db.assessment_attempts.count_documents({
        "user_id": user_id,
        "assessment_id": ObjectId(id)
    })
    if attempts_count >= assessment["max_attempts"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum limit of {assessment['max_attempts']} attempts for this assessment."
        )

    # 3. Cooldown Validation
    latest_attempt = await db.assessment_attempts.find_one(
        {"user_id": user_id, "assessment_id": ObjectId(id)},
        sort=[("submitted_at", -1)]
    )
    if latest_attempt and latest_attempt.get("submitted_at"):
        cooldown_expiry = latest_attempt["submitted_at"] + timedelta(hours=assessment["cooldown_hours"])
        if datetime.utcnow() < cooldown_expiry:
            remaining = cooldown_expiry - datetime.utcnow()
            hours_left = int(remaining.total_seconds() // 3600)
            mins_left = int((remaining.total_seconds() % 3600) // 60)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Assessment cooldown active. Please wait {hours_left}h {mins_left}m before attempting again."
            )

    # 4. Fetch random questions from pool
    # Master pools questions from ALL categories, languages pool from specific ID
    if assessment["assessment_type"] == "master":
        questions_pool = await db.assessment_questions.find({"active": True}).to_list(length=2000)
    else:
        questions_pool = await db.assessment_questions.find({
            "assessment_id": ObjectId(id),
            "active": True
        }).to_list(length=500)

    if len(questions_pool) < assessment["questions_per_attempt"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Insufficient questions in the database pool for this assessment."
        )

    # Shuffled selection
    selected_questions = random.sample(questions_pool, assessment["questions_per_attempt"])
    random.shuffle(selected_questions)

    # Map question order and shuffle options for every question
    question_order = []
    shuffled_options = {}
    client_questions = []

    for q in selected_questions:
        q_id_str = str(q["_id"])
        question_order.append(q_id_str)
        
        # Shuffle option ordering
        options_copy = list(q["options"])
        random.shuffle(options_copy)
        shuffled_options[q_id_str] = options_copy
        
        client_questions.append(
            QuestionResponse(
                id=q_id_str,
                question_text=q["question_text"],
                options=options_copy
            )
        )

    # Create attempt record
    started_at = datetime.utcnow()
    attempt_doc = {
        "_id": ObjectId(),
        "user_id": user_id,
        "assessment_id": ObjectId(id),
        "question_order": question_order,
        "shuffled_options": shuffled_options,
        "answers": [],
        "score": 0,
        "percentage": 0.0,
        "badge": "failed",
        "passed": False,
        "status": "active",
        "started_at": started_at,
        "submitted_at": None,
        "duration_taken_seconds": 0
    }

    await db.assessment_attempts.insert_one(attempt_doc)
    attempt_id = attempt_doc["_id"]

    # Create active session
    expires_at = started_at + timedelta(minutes=assessment["duration_minutes"])
    session_doc = {
        "attempt_id": attempt_id,
        "user_id": user_id,
        "assessment_id": ObjectId(id),
        "started_at": started_at,
        "expires_at": expires_at
    }
    await db.active_assessment_sessions.insert_one(session_doc)

    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="ASSESSMENT_STARTED",
        details=f"Started assessment attempt: {assessment['title']} (Attempt ID: {attempt_id})"
    )

    return AttemptStartResponse(
        attempt_id=str(attempt_id),
        assessment_title=assessment["title"],
        duration_minutes=assessment["duration_minutes"],
        expires_at=expires_at,
        questions=client_questions,
        answers=[]
    )

@router.get("/attempts/{attempt_id}/resume", response_model=AttemptStartResponse)
async def resume_attempt(
    attempt_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(attempt_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")

    session = await db.active_assessment_sessions.find_one({"attempt_id": ObjectId(attempt_id)})
    if not session or session["user_id"] != ObjectId(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active assessment session found or session ownership invalid."
        )

    # Expiry Check
    if datetime.utcnow() > session["expires_at"]:
        await check_and_auto_submit_session(session, db)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assessment session has expired.")

    attempt = await db.assessment_attempts.find_one({"_id": ObjectId(attempt_id)})
    if not attempt or attempt["status"] != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assessment attempt not found or inactive.")

    assessment = await db.assessments.find_one({"_id": attempt["assessment_id"]})
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Fetch questions in correct shuffled order
    q_ids = [ObjectId(qid) for qid in attempt["question_order"]]
    db_questions = await db.assessment_questions.find({"_id": {"$in": q_ids}}).to_list(length=100)

    q_map = {str(q["_id"]): q for q in db_questions}
    sorted_questions = []
    for qid in attempt["question_order"]:
        if qid in q_map:
            q_data = q_map[qid]
            options = attempt["shuffled_options"].get(qid, q_data["options"])
            sorted_questions.append(
                QuestionResponse(
                    id=qid,
                    question_text=q_data["question_text"],
                    options=options
                )
            )

    return AttemptStartResponse(
        attempt_id=str(attempt["_id"]),
        assessment_title=assessment["title"],
        duration_minutes=assessment["duration_minutes"],
        expires_at=session["expires_at"],
        questions=sorted_questions,
        answers=attempt.get("answers", [])
    )

@router.post("/attempts/{attempt_id}/save-answer")
async def save_answer(
    attempt_id: str,
    answer_in: SaveAnswerRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(attempt_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")

    session = await db.active_assessment_sessions.find_one({"attempt_id": ObjectId(attempt_id)})
    if not session or session["user_id"] != ObjectId(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active assessment session found or session ownership invalid."
        )

    # Expiry Check / Auto-Submit enforcement
    if datetime.utcnow() > session["expires_at"]:
        await check_and_auto_submit_session(session, db)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assessment session has expired.")

    # Save intermediate answer
    attempt = await db.assessment_attempts.find_one({"_id": ObjectId(attempt_id)})
    if not attempt or answer_in.question_id not in attempt["question_order"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question is not part of this attempt.")

    # Remove existing answer if present
    await db.assessment_attempts.update_one(
        {"_id": ObjectId(attempt_id)},
        {"$pull": {"answers": {"question_id": answer_in.question_id}}}
    )

    # Add new answer
    new_answer = {
        "question_id": answer_in.question_id,
        "selected_answer": answer_in.selected_answer
    }
    await db.assessment_attempts.update_one(
        {"_id": ObjectId(attempt_id)},
        {"$push": {"answers": new_answer}}
    )

    return {"success": True, "message": "Answer auto-saved successfully"}

@router.post("/attempts/{attempt_id}/submit", response_model=AttemptSubmitResponse)
async def submit_assessment(
    attempt_id: str,
    submit_in: Optional[AttemptSubmitRequest] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(attempt_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid attempt ID format")

    attempt = await db.assessment_attempts.find_one({
        "_id": ObjectId(attempt_id),
        "user_id": ObjectId(current_user["id"])
    })
    if not attempt or attempt["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment attempt not found or already submitted."
        )

    assessment = await db.assessments.find_one({"_id": attempt["assessment_id"]})
    session = await db.active_assessment_sessions.find_one({"attempt_id": ObjectId(attempt_id)})

    # Expiry check / Auto timeout fallback
    is_timeout = False
    submitted_at = datetime.utcnow()
    if session and submitted_at > session["expires_at"]:
        is_timeout = True
        submitted_at = session["expires_at"]

    # Save final batch answers if provided in payload
    if submit_in and submit_in.answers and not is_timeout:
        for ans in submit_in.answers:
            q_id = ans.get("question_id")
            selected = ans.get("selected_answer")
            if q_id in attempt["question_order"]:
                await db.assessment_attempts.update_one(
                    {"_id": ObjectId(attempt_id)},
                    {"$pull": {"answers": {"question_id": q_id}}}
                )
                await db.assessment_attempts.update_one(
                    {"_id": ObjectId(attempt_id)},
                    {"$push": {"answers": {"question_id": q_id, "selected_answer": selected}}}
                )

    # Re-retrieve updated attempt doc
    attempt = await db.assessment_attempts.find_one({"_id": ObjectId(attempt_id)})

    # Evaluate MCQs
    q_ids = [ObjectId(qid) for qid in attempt["question_order"]]
    questions = await db.assessment_questions.find({"_id": {"$in": q_ids}}).to_list(length=100)
    correct_map = {str(q["_id"]): q["correct_answer"] for q in questions}

    score = 0
    for ans in attempt.get("answers", []):
        q_id = ans["question_id"]
        if q_id in correct_map and ans["selected_answer"] == correct_map[q_id]:
            score += 1

    total_questions = len(attempt["question_order"])
    percentage = round((score / total_questions) * 100, 2) if total_questions > 0 else 0.0

    # Badge assignment
    badge = "failed"
    passed = False
    if percentage >= assessment["passing_percentage"]:
        passed = True
        if percentage >= assessment["badge_rules"].get("gold", 90):
            badge = "gold"
        elif percentage >= assessment["badge_rules"].get("silver", 75):
            badge = "silver"
        else:
            badge = "bronze"

    duration_taken = int((submitted_at - attempt["started_at"]).total_seconds())

    # Update attempt record
    status_str = "timed_out" if is_timeout else "submitted"
    await db.assessment_attempts.update_one(
        {"_id": ObjectId(attempt_id)},
        {
            "$set": {
                "score": score,
                "percentage": percentage,
                "badge": badge,
                "passed": passed,
                "status": status_str,
                "submitted_at": submitted_at,
                "duration_taken_seconds": max(0, duration_taken)
            }
        }
    )

    # Remove active session lock
    if session:
        await db.active_assessment_sessions.delete_one({"_id": session["_id"]})

    # Log assessment submission
    action_str = "ASSESSMENT_PASSED" if passed else "ASSESSMENT_FAILED"
    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action=action_str,
        details=f"Completed: {assessment['title']}. Score: {percentage}% ({badge.upper()})"
    )

    unlocked_achievements = []
    certificate_id = None

    if passed:
        # Trigger Achievements
        # First assessment attempt submit
        first_attempt = await db.assessment_attempts.count_documents({"user_id": ObjectId(current_user["id"])}) == 1
        if first_attempt:
            unlocked_achievements.append("FIRST_ASSESSMENT")

        # First Certificate
        first_cert = await db.certificates.count_documents({"user_id": ObjectId(current_user["id"])}) == 0
        if first_cert:
            unlocked_achievements.append("FIRST_CERTIFICATE")

        # Specific certifications
        title_lower = assessment["title"].lower()
        if "python" in title_lower:
            unlocked_achievements.append("PYTHON_CERTIFIED")
        elif "javascript" in title_lower:
            unlocked_achievements.append("JAVASCRIPT_CERTIFIED")
        elif "c++" in title_lower:
            unlocked_achievements.append("CPP_CERTIFIED")
        elif "java" in title_lower:
            unlocked_achievements.append("JAVA_CERTIFIED")
        elif "c programming" in title_lower:
            unlocked_achievements.append("C_CERTIFIED")
        elif "data structures" in title_lower:
            unlocked_achievements.append("DATA_STRUCTURES_CERTIFIED")
        elif "algorithms" in title_lower:
            unlocked_achievements.append("ALGORITHMS_CERTIFIED")
        elif "master" in title_lower:
            unlocked_achievements.append("MASTER_PROGRAMMER")

        # Check total certifications counts
        # Add new mock certificate temporarily to count check
        cert_count = await db.certificates.count_documents({"user_id": ObjectId(current_user["id"])}) + 1
        if cert_count >= 5:
            unlocked_achievements.append("FIVE_CERTIFICATES")
        if cert_count >= 10:
            unlocked_achievements.append("TEN_CERTIFICATES")

        # Perfect score
        if percentage == 100.0:
            unlocked_achievements.append("PERFECT_SCORE")

        # Save unlocked achievements to DB unique constraint
        for ach in unlocked_achievements:
            try:
                await db.user_achievements.insert_one({
                    "user_id": ObjectId(current_user["id"]),
                    "achievement_type": ach,
                    "unlocked_at": datetime.utcnow()
                })
                
                await log_activity(
                    user_id=current_user["id"],
                    email=current_user["email"],
                    action="ACHIEVEMENT_UNLOCKED",
                    details=f"Unlocked achievement badge: {ach}"
                )
            except Exception:
                pass  # Ignore duplicates from unique index constraints

        # Generate Certificate
        certificate_id = "CERT-" + secrets.token_hex(6).upper()
        verif_hash = secrets.token_urlsafe(16)
        
        pdf_path = generate_certificate_pdf(
            certificate_id=certificate_id,
            username=current_user["name"],
            assessment_title=assessment["title"],
            badge=badge,
            percentage=percentage
        )

        cert_doc = {
            "certificate_id": certificate_id,
            "verification_hash": verif_hash,
            "user_id": ObjectId(current_user["id"]),
            "assessment_id": assessment["_id"],
            "attempt_id": ObjectId(attempt_id),
            "badge": badge,
            "percentage": percentage,
            "pdf_path": pdf_path,
            "email_sent": False,
            "revoked": False,
            "revoked_reason": None,
            "issued_at": datetime.utcnow()
        }
        await db.certificates.insert_one(cert_doc)

        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="CERTIFICATE_GENERATED",
            details=f"Generated certificate {certificate_id} for assessment {assessment['title']}"
        )

        # Send Email
        verif_url = f"https://dyccodingcampus.com/verify-certificate/{certificate_id}"
        email_sent = await send_certificate_email(
            email=current_user["email"],
            name=current_user["name"],
            title=assessment["title"],
            badge=badge.capitalize(),
            score=percentage,
            pdf_path=pdf_path,
            verification_url=verif_url
        )

        if email_sent:
            await db.certificates.update_one(
                {"certificate_id": certificate_id},
                {"$set": {"email_sent": True}}
            )
            await log_activity(
                user_id=current_user["id"],
                email=current_user["email"],
                action="CERTIFICATE_EMAILED",
                details=f"Emailed certificate {certificate_id} successfully to {current_user['email']}"
            )

    return AttemptSubmitResponse(
        attempt_id=attempt_id,
        passed=passed,
        score=score,
        percentage=percentage,
        badge=badge,
        certificate_id=certificate_id,
        unlocked_achievements=unlocked_achievements
    )

# Mapped at the top to prevent route collision with dynamic /{id}

@router.get("/certificates/{certificate_id}/download")
async def download_certificate(
    certificate_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db=Depends(get_db)
):
    cert = await db.certificates.find_one({
        "certificate_id": certificate_id,
        "revoked": False
    })
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found or revoked.")

    if not os.path.exists(cert["pdf_path"]):
        user = await db.users.find_one({"_id": cert["user_id"]})
        assess = await db.assessments.find_one({"_id": cert["assessment_id"]})
        if not user or not assess:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate metadata references missing user or assessment.")
        try:
            generate_certificate_pdf(
                certificate_id=cert["certificate_id"],
                username=user["name"],
                assessment_title=assess["title"],
                badge=cert["badge"],
                percentage=cert["percentage"]
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to regenerate certificate PDF: {str(e)}"
            )

    user_id = current_user["id"] if current_user else None
    email = current_user["email"] if current_user else None
    details_str = f"Downloaded certificate PDF {certificate_id}" + (" (Guest)" if not current_user else "")

    await log_activity(
        user_id=user_id,
        email=email,
        action="CERTIFICATE_DOWNLOADED",
        details=details_str
    )

    response = FileResponse(
        path=cert["pdf_path"],
        filename=f"certificate_{certificate_id}.pdf",
        media_type="application/pdf"
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@router.get("/certificates/verify/{certificate_id}", response_model=CertificateVerifyResponse)
async def verify_certificate(
    certificate_id: str,
    db=Depends(get_db)
):
    cert = await db.certificates.find_one({"certificate_id": certificate_id})
    if not cert:
        return CertificateVerifyResponse(
            valid=False,
            certificate_id=certificate_id,
            user_name="Unknown",
            assessment_title="Unknown",
            badge="failed",
            percentage=0.0,
            issued_at=datetime.utcnow(),
            revoked=True,
            revoked_reason="Certificate ID does not exist."
        )

    user = await db.users.find_one({"_id": cert["user_id"]})
    assess = await db.assessments.find_one({"_id": cert["assessment_id"]})
    
    return CertificateVerifyResponse(
        valid=not cert.get("revoked", False),
        certificate_id=certificate_id,
        user_name=user["name"] if user else "Unknown User",
        assessment_title=assess["title"] if assess else "Unknown Assessment",
        badge=cert["badge"],
        percentage=cert["percentage"],
        issued_at=cert["issued_at"],
        revoked=cert.get("revoked", False),
        revoked_reason=cert.get("revoked_reason")
    )
