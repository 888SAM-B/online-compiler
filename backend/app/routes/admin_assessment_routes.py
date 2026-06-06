from fastapi import APIRouter, Depends, HTTPException, status, Response, File, UploadFile
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import json
import csv
import uuid
import io

from app.database import get_db
from app.auth import get_current_admin_user, log_activity
from app.models import ImportPreviewResponse, ImportSummaryResponse

router = APIRouter(prefix="/admin/assessments", tags=["admin-assessments"])

def serialize_doc(doc: dict) -> dict:
    doc_copy = doc.copy()
    doc_copy["id"] = str(doc_copy["_id"])
    doc_copy.pop("_id", None)
    for key, value in doc_copy.items():
        if isinstance(value, ObjectId):
            doc_copy[key] = str(value)
    return doc_copy

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_assessment(
    assess_in: dict,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    new_assess = {
        "title": assess_in.get("title"),
        "description": assess_in.get("description"),
        "assessment_type": assess_in.get("assessment_type", "language"),
        "language": assess_in.get("language"),
        "duration_minutes": int(assess_in.get("duration_minutes", 60)),
        "questions_per_attempt": int(assess_in.get("questions_per_attempt", 30)),
        "question_pool_size": int(assess_in.get("question_pool_size", 100)),
        "passing_percentage": int(assess_in.get("passing_percentage", 50)),
        "max_attempts": int(assess_in.get("max_attempts", 3)),
        "cooldown_hours": int(assess_in.get("cooldown_hours", 24)),
        "badge_rules": assess_in.get("badge_rules", {"gold": 90, "silver": 75, "bronze": 50}),
        "active": bool(assess_in.get("active", True)),
        "question_pool_version": 1,
        "created_by": str(admin_user["_id"]),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.assessments.insert_one(new_assess)
    new_assess["id"] = str(result.inserted_id)
    new_assess.pop("_id", None)
    
    await log_activity(
        user_id=str(admin_user["_id"]),
        email=admin_user["email"],
        action="QUESTION_POOL_REGENERATED",
        details=f"Created new assessment template: {new_assess['title']}"
    )
    
    return new_assess

@router.put("/{id}")
async def update_assessment(
    id: str,
    assess_in: dict,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
        
    assess = await db.assessments.find_one({"_id": ObjectId(id)})
    if not assess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    update_fields = {}
    for field in ["title", "description", "assessment_type", "language", "duration_minutes", 
                  "questions_per_attempt", "question_pool_size", "passing_percentage", 
                  "max_attempts", "cooldown_hours", "badge_rules", "active"]:
        if field in assess_in:
            update_fields[field] = assess_in[field]
            
    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        await db.assessments.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
        
    updated_doc = await db.assessments.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated_doc)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assessment(
    id: str,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
        
    # Soft delete (make inactive)
    await db.assessments.update_one({"_id": ObjectId(id)}, {"$set": {"active": False, "updated_at": datetime.utcnow()}})
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{id}/questions", status_code=status.HTTP_201_CREATED)
async def add_question(
    id: str,
    q_in: dict,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
        
    assess = await db.assessments.find_one({"_id": ObjectId(id)})
    if not assess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    new_q = {
        "assessment_id": ObjectId(id),
        "question_text": q_in.get("question_text"),
        "question_type": "mcq",
        "options": q_in.get("options", []),
        "correct_answer": q_in.get("correct_answer"),
        "difficulty": q_in.get("difficulty", "easy"),
        "explanation": q_in.get("explanation", ""),
        "points": int(q_in.get("points", 1)),
        "active": True,
        "created_at": datetime.utcnow()
    }
    
    result = await db.assessment_questions.insert_one(new_q)
    new_q["id"] = str(result.inserted_id)
    new_q["assessment_id"] = str(new_q["assessment_id"])
    new_q.pop("_id", None)
    
    return new_q

@router.put("/questions/{q_id}")
async def update_question(
    q_id: str,
    q_in: dict,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(q_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")

    q = await db.assessment_questions.find_one({"_id": ObjectId(q_id)})
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    update_fields = {}
    for field in ["question_text", "options", "correct_answer", "difficulty", "explanation", "points", "active"]:
        if field in q_in:
            update_fields[field] = q_in[field]

    if update_fields:
        await db.assessment_questions.update_one({"_id": ObjectId(q_id)}, {"$set": update_fields})

    updated_doc = await db.assessment_questions.find_one({"_id": ObjectId(q_id)})
    return serialize_doc(updated_doc)

@router.delete("/questions/{q_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    q_id: str,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(q_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")

    await db.assessment_questions.update_one({"_id": ObjectId(q_id)}, {"$set": {"active": False}})
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{id}/regenerate")
async def regenerate_pool(
    id: str,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")

    assess = await db.assessments.find_one({"_id": ObjectId(id)})
    if not assess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    new_version = assess.get("question_pool_version", 1) + 1
    await db.assessments.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"question_pool_version": new_version, "updated_at": datetime.utcnow()}}
    )

    # Invalidate active sessions for this assessment to prevent cheating
    await db.active_assessment_sessions.delete_many({"assessment_id": ObjectId(id)})

    await log_activity(
        user_id=str(admin_user["_id"]),
        email=admin_user["email"],
        action="QUESTION_POOL_REGENERATED",
        details=f"Regenerated question pool for assessment: {assess['title']} (New Version: {new_version})"
    )

    return {"success": True, "new_version": new_version}

@router.get("/export")
async def export_assessments(
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    assessments = await db.assessments.find({}).to_list(length=1000)
    questions = await db.assessment_questions.find({}).to_list(length=10000)
    
    return {
        "assessments": [serialize_doc(a) for a in assessments],
        "questions": [serialize_doc(q) for q in questions]
    }

@router.post("/import")
async def import_assessments(
    payload: dict,
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    imported_assessments = payload.get("assessments", [])
    imported_questions = payload.get("questions", [])

    id_map = {}
    
    # Process assessments
    for assess in imported_assessments:
        old_id = assess.get("id")
        new_id = ObjectId()
        id_map[old_id] = new_id
        
        doc = {
            "_id": new_id,
            "title": assess.get("title"),
            "description": assess.get("description"),
            "assessment_type": assess.get("assessment_type", "language"),
            "language": assess.get("language"),
            "duration_minutes": int(assess.get("duration_minutes", 60)),
            "questions_per_attempt": int(assess.get("questions_per_attempt", 30)),
            "question_pool_size": int(assess.get("question_pool_size", 100)),
            "passing_percentage": int(assess.get("passing_percentage", 50)),
            "max_attempts": int(assess.get("max_attempts", 3)),
            "cooldown_hours": int(assess.get("cooldown_hours", 24)),
            "badge_rules": assess.get("badge_rules", {"gold": 90, "silver": 75, "bronze": 50}),
            "active": bool(assess.get("active", True)),
            "question_pool_version": 1,
            "created_by": str(admin_user["_id"]),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.assessments.insert_one(doc)

    # Process questions
    for q in imported_questions:
        old_assess_id = q.get("assessment_id")
        new_assess_id = id_map.get(old_assess_id)
        if not new_assess_id:
            # Fallback
            new_assess_id = ObjectId()

        doc = {
            "assessment_id": new_assess_id,
            "question_text": q.get("question_text"),
            "question_type": "mcq",
            "options": q.get("options", []),
            "correct_answer": q.get("correct_answer"),
            "difficulty": q.get("difficulty", "easy"),
            "explanation": q.get("explanation", ""),
            "points": int(q.get("points", 1)),
            "active": True,
            "created_at": datetime.utcnow()
        }
        await db.assessment_questions.insert_one(doc)

    return {"success": True, "imported_assessments": len(imported_assessments), "imported_questions": len(imported_questions)}

@router.get("/analytics")
async def get_analytics(
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    attempts = await db.assessment_attempts.find({"status": {"$in": ["submitted", "timed_out"]}}).to_list(length=100000)
    
    if not attempts:
        return {
            "total_attempts": 0,
            "pass_rate": 0.0,
            "average_score": 0.0,
            "gold_badges": 0,
            "silver_badges": 0,
            "bronze_badges": 0,
            "certificates_generated": 0
        }

    total_attempts = len(attempts)
    passed_attempts = sum(1 for a in attempts if a.get("passed", False))
    pass_rate = round((passed_attempts / total_attempts) * 100, 2)
    
    total_score_percentage = sum(a.get("percentage", 0) for a in attempts)
    average_score = round(total_score_percentage / total_attempts, 2)

    gold = sum(1 for a in attempts if a.get("badge") == "gold")
    silver = sum(1 for a in attempts if a.get("badge") == "silver")
    bronze = sum(1 for a in attempts if a.get("badge") == "bronze")
    
    certificates_count = await db.certificates.count_documents({"revoked": False})

    return {
        "total_attempts": total_attempts,
        "pass_rate": pass_rate,
        "average_score": average_score,
        "gold_badges": gold,
        "silver_badges": silver,
        "bronze_badges": bronze,
        "certificates_generated": certificates_count
    }


def parse_and_validate_file(contents: bytes, filename: str) -> dict:
    validation_errors = []
    raw_questions = []
    
    # Check extension
    if filename.endswith(".json"):
        try:
            data = json.loads(contents.decode("utf-8-sig"))
            if isinstance(data, dict) and "questions" in data:
                items = data["questions"]
            elif isinstance(data, list):
                items = data
            else:
                return {
                    "valid": False,
                    "total_questions": 0,
                    "easy": 0,
                    "medium": 0,
                    "hard": 0,
                    "duplicates_found": 0,
                    "validation_errors": ["JSON must be a list of questions or contain a 'questions' key."],
                    "questions": []
                }
            
            for idx, item in enumerate(items, start=1):
                if not isinstance(item, dict):
                    validation_errors.append(f"Item {idx}: must be a JSON object/dictionary.")
                    continue
                
                # Check for options list
                opts = item.get("options", [])
                if not isinstance(opts, list):
                    opts = []
                
                raw_questions.append({
                    "question_number": item.get("question_number"),
                    "question_text": str(item.get("question_text", "")).strip(),
                    "options": [str(opt).strip() for opt in opts],
                    "correct_answer": str(item.get("correct_answer", "")).strip(),
                    "difficulty": str(item.get("difficulty", "easy")).strip().lower(),
                    "explanation": str(item.get("explanation", "")).strip(),
                    "points": item.get("points")
                })
        except Exception as e:
            return {
                "valid": False,
                "total_questions": 0,
                "easy": 0,
                "medium": 0,
                "hard": 0,
                "duplicates_found": 0,
                "validation_errors": [f"Failed to parse JSON file: {str(e)}"],
                "questions": []
            }
            
    elif filename.endswith(".csv"):
        try:
            csv_text = contents.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(csv_text))
            
            headers = reader.fieldnames if reader.fieldnames else []
            required_headers = {"question_text", "option_1", "option_2", "option_3", "option_4", "correct_answer"}
            missing = required_headers - set(headers)
            if missing:
                return {
                    "valid": False,
                    "total_questions": 0,
                    "easy": 0,
                    "medium": 0,
                    "hard": 0,
                    "duplicates_found": 0,
                    "validation_errors": [f"Missing required CSV column headers: {', '.join(missing)}"],
                    "questions": []
                }
                
            for idx, row in enumerate(reader, start=1):
                options = [
                    str(row.get("option_1", "")).strip(),
                    str(row.get("option_2", "")).strip(),
                    str(row.get("option_3", "")).strip(),
                    str(row.get("option_4", "")).strip()
                ]
                q_num = None
                if row.get("question_number"):
                    try:
                        q_num = int(row.get("question_number"))
                    except ValueError:
                        pass
                
                points_val = 1
                if row.get("points"):
                    try:
                        points_val = int(row.get("points"))
                    except ValueError:
                        pass
                        
                raw_questions.append({
                    "question_number": q_num,
                    "question_text": str(row.get("question_text", "")).strip(),
                    "options": options,
                    "correct_answer": str(row.get("correct_answer", "")).strip(),
                    "difficulty": str(row.get("difficulty", "easy")).strip().lower(),
                    "explanation": str(row.get("explanation", "")).strip(),
                    "points": points_val
                })
        except Exception as e:
            return {
                "valid": False,
                "total_questions": 0,
                "easy": 0,
                "medium": 0,
                "hard": 0,
                "duplicates_found": 0,
                "validation_errors": [f"Failed to parse CSV file: {str(e)}"],
                "questions": []
            }
    else:
        return {
            "valid": False,
            "total_questions": 0,
            "easy": 0,
            "medium": 0,
            "hard": 0,
            "duplicates_found": 0,
            "validation_errors": ["Unsupported file format. Only .json and .csv are supported."],
            "questions": []
        }

    seen_texts = set()
    duplicates_count = 0
    easy_count = 0
    medium_count = 0
    hard_count = 0
    validation_errors = []
    
    for idx, q in enumerate(raw_questions, start=1):
        q_errors = []
        text = q["question_text"]
        
        if not text or len(text) < 10:
            q_errors.append(f"Question {idx}: 'question_text' must be at least 10 characters long.")
            
        norm_text = " ".join(text.lower().split())
        if norm_text:
            if norm_text in seen_texts:
                duplicates_count += 1
                q_errors.append(f"Question {idx}: Duplicate question text detected.")
            else:
                seen_texts.add(norm_text)
                
        opts = q["options"]
        if len(opts) != 4 or any(not o for o in opts):
            q_errors.append(f"Question {idx}: Must have exactly 4 non-empty options.")
            
        correct = q["correct_answer"]
        if not correct:
            q_errors.append(f"Question {idx}: 'correct_answer' is missing.")
        elif correct not in opts:
            q_errors.append(f"Question {idx}: 'correct_answer' ('{correct}') must be one of the four options: {opts}.")
            
        diff = q["difficulty"]
        if diff not in {"easy", "medium", "hard"}:
            q_errors.append(f"Question {idx}: Invalid difficulty '{diff}'. Allowed: easy, medium, hard.")
        else:
            if diff == "easy":
                easy_count += 1
            elif diff == "medium":
                medium_count += 1
            elif diff == "hard":
                hard_count += 1
                
        pts = q["points"]
        if pts is not None:
            try:
                pts_int = int(pts)
                if not (1 <= pts_int <= 10):
                    q_errors.append(f"Question {idx}: 'points' must be between 1 and 10.")
            except ValueError:
                q_errors.append(f"Question {idx}: 'points' must be an integer.")
                
        if q_errors:
            validation_errors.extend(q_errors)
            
    return {
        "valid": len(validation_errors) == 0,
        "total_questions": len(raw_questions),
        "easy": easy_count,
        "medium": medium_count,
        "hard": hard_count,
        "duplicates_found": duplicates_count,
        "validation_errors": validation_errors,
        "questions": raw_questions if len(validation_errors) == 0 else []
    }


@router.get("/templates/questions.csv")
async def get_csv_template():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["question_number", "question_text", "option_1", "option_2", "option_3", "option_4", "correct_answer", "difficulty", "explanation", "points"])
    writer.writerow([1, "What is the output of print(2 ** 3) in Python?", "6", "8", "9", "Error", "8", "easy", "The ** operator computes the power of a number.", 1])
    writer.writerow([2, "Which data structure operates on a Last-In, First-Out (LIFO) model?", "Queue", "Array", "Stack", "Linked List", "Stack", "medium", "Stacks push and pop elements from the same end (LIFO).", 2])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=questions_template.csv"}
    )


@router.get("/templates/questions.json")
async def get_json_template():
    template_data = {
        "questions": [
            {
                "question_number": 1,
                "question_text": "What is the output of print(2 ** 3) in Python?",
                "options": ["6", "8", "9", "Error"],
                "correct_answer": "8",
                "difficulty": "easy",
                "explanation": "The ** operator computes the power of a number.",
                "points": 1
            },
            {
                "question_number": 2,
                "question_text": "Which data structure operates on a Last-In, First-Out (LIFO) model?",
                "options": ["Queue", "Array", "Stack", "Linked List"],
                "correct_answer": "Stack",
                "difficulty": "medium",
                "explanation": "Stacks push and pop elements from the same end (LIFO).",
                "points": 2
            }
        ]
    }
    
    json_str = json.dumps(template_data, indent=2)
    return StreamingResponse(
        io.BytesIO(json_str.encode("utf-8")),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=questions_template.json"}
    )


@router.post("/{id}/import-preview", response_model=ImportPreviewResponse)
async def import_preview(
    id: str,
    file: UploadFile = File(...),
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
        
    assess = await db.assessments.find_one({"_id": ObjectId(id)})
    if not assess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
        
    contents = await file.read()
    result = parse_and_validate_file(contents, file.filename)
    
    return ImportPreviewResponse(
        valid=result["valid"],
        total_questions=result["total_questions"],
        easy=result["easy"],
        medium=result["medium"],
        hard=result["hard"],
        duplicates_found=result["duplicates_found"],
        validation_errors=result["validation_errors"]
    )


@router.post("/{id}/import-questions", response_model=ImportSummaryResponse)
async def import_questions(
    id: str,
    file: UploadFile = File(...),
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
        
    assess = await db.assessments.find_one({"_id": ObjectId(id)})
    if not assess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
        
    contents = await file.read()
    result = parse_and_validate_file(contents, file.filename)
    
    if not result["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File validation failed. Please preview and fix all errors first."
        )
        
    raw_qs = result["questions"]
    if not raw_qs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions found to import.")
        
    batch_id = str(uuid.uuid4())
    db_questions = []
    
    for idx, q in enumerate(raw_qs, start=1):
        db_questions.append({
            "assessment_id": ObjectId(id),
            "question_number": q["question_number"] if q["question_number"] is not None else idx,
            "question_text": q["question_text"],
            "question_type": "mcq",
            "options": q["options"],
            "correct_answer": q["correct_answer"],
            "difficulty": q["difficulty"],
            "explanation": q["explanation"],
            "points": int(q["points"]) if q["points"] is not None else 1,
            "active": True,
            "import_batch_id": batch_id,
            "created_at": datetime.utcnow()
        })
        
    try:
        # Non-Replica-Set Safe Strategy:
        # 1. Insert new questions
        await db.assessment_questions.insert_many(db_questions)
        
        # 2. Delete old questions
        await db.assessment_questions.delete_many({
            "assessment_id": ObjectId(id),
            "import_batch_id": {"$ne": batch_id}
        })
        
        # 3. Update assessment question pool size & version
        new_version = assess.get("question_pool_version", 1) + 1
        await db.assessments.update_one(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "question_pool_size": len(db_questions),
                    "question_pool_version": new_version,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Invalidate active sessions
        await db.active_assessment_sessions.delete_many({"assessment_id": ObjectId(id)})
        
        # Log activity
        file_ext = "json" if file.filename.endswith(".json") else "csv"
        await log_activity(
            user_id=str(admin_user["_id"]),
            email=admin_user["email"],
            action="ASSESSMENT_QUESTIONS_IMPORTED",
            details=f"Imported {len(db_questions)} questions for '{assess['title']}' via {file_ext.upper()}. Batch: {batch_id}"
        )
        
        return ImportSummaryResponse(
            success=True,
            imported_count=len(db_questions),
            import_batch_id=batch_id,
            assessment_title=assess["title"],
            message=f"Successfully imported {len(db_questions)} questions."
        )
        
    except Exception as e:
        # Cleanup partial batch
        try:
            await db.assessment_questions.delete_many({"import_batch_id": batch_id})
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during question import: {str(e)}"
        )


@router.get("/certificates", response_model=List[Dict[str, Any]])
async def get_all_certificates(
    admin_user: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    cursor = db.certificates.find()
    certs = await cursor.to_list(length=1000)
    
    user_ids = [c["user_id"] for c in certs if "user_id" in c]
    assessment_ids = [c["assessment_id"] for c in certs if "assessment_id" in c]
    
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(length=1000)
    assessments = await db.assessments.find({"_id": {"$in": assessment_ids}}).to_list(length=1000)
    
    user_map = {str(u["_id"]): u for u in users}
    assess_map = {str(a["_id"]): a for a in assessments}
    
    results = []
    for c in certs:
        u_id_str = str(c.get("user_id"))
        a_id_str = str(c.get("assessment_id"))
        
        user_info = user_map.get(u_id_str, {})
        assess_info = assess_map.get(a_id_str, {})
        
        results.append({
            "id": str(c["_id"]),
            "certificate_id": c.get("certificate_id"),
            "user_email": user_info.get("email", "Unknown User"),
            "user_name": user_info.get("name", "Unknown"),
            "assessment_title": assess_info.get("title", "Unknown Assessment"),
            "badge": c.get("badge", "bronze"),
            "percentage": c.get("percentage", 0.0),
            "issued_at": c.get("issued_at"),
            "revoked": c.get("revoked", False)
        })
        
    return results

