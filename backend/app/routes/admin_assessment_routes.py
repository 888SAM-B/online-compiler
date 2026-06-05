from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_admin_user, log_activity

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
