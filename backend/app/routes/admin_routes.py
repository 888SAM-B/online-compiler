from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import json
import gzip
from io import BytesIO

from app.database import get_db
from app.auth import get_current_admin_user, log_activity
from app.models import (
    UserResponse,
    AnalyticsResponse,
    DailyExecution,
    LanguageResponse,
    LanguageStatusUpdate,
    ActivityLogResponse,
    ChallengeCreate,
    ChallengeUpdate,
    AdminChallengeResponse
)

router = APIRouter(prefix="/admin", tags=["admin"])

# Helper to serialize user
def serialize_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    user.pop("password", None)
    user.pop("_id", None)
    return user

# Helper to serialize language
def serialize_lang(lang: dict) -> dict:
    lang["id"] = str(lang["_id"])
    lang.pop("_id", None)
    return lang

# Helper to serialize log
def serialize_log(log: dict) -> dict:
    log["id"] = str(log["_id"])
    log.pop("_id", None)
    if "user_id" in log and log["user_id"] is not None:
        log["user_id"] = str(log["user_id"])
    return log

@router.get("/users", response_model=List[UserResponse])
async def get_users(
    search: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
        
    cursor = db.users.find(query).sort("created_at", -1)
    users = await cursor.to_list(length=100)
    return [serialize_user(u) for u in users]

@router.put("/users/{id}/block", response_model=UserResponse)
async def toggle_block_user(
    id: str,
    payload: dict,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format")
        
    if id == current_admin["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot block yourself")
        
    block_status = payload.get("is_blocked", False)
    
    result = await db.users.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"is_blocked": block_status, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    user = await db.users.find_one({"_id": ObjectId(id)})
    
    # Log blocking
    action = "user_blocked" if block_status else "user_unblocked"
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action=action,
        details=f"{'Blocked' if block_status else 'Unblocked'} user: {user.get('email')}"
    )
    
    return serialize_user(user)

@router.delete("/users/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    id: str,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format")
        
    if id == current_admin["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete yourself")
        
    user = await db.users.find_one({"_id": ObjectId(id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    # Delete user and their programs and history
    await db.users.delete_one({"_id": ObjectId(id)})
    await db.programs.delete_many({"user_id": id})
    await db.execution_history.delete_many({"user_id": id})
    
    # Log deletion
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action="user_deleted",
        details=f"Deleted user: {user.get('email')} and all associated data"
    )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/languages", response_model=List[LanguageResponse])
async def get_languages(
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    cursor = db.supported_languages.find({}).sort("name", 1)
    languages = await cursor.to_list(length=50)
    return [serialize_lang(l) for l in languages]

@router.put("/languages/{name}", response_model=LanguageResponse)
async def update_language_status(
    name: str,
    payload: LanguageStatusUpdate,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    result = await db.supported_languages.update_one(
        {"name": name},
        {"$set": {"enabled": payload.enabled, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
        
    lang = await db.supported_languages.find_one({"name": name})
    
    # Log toggle
    action = "language_enabled" if payload.enabled else "language_disabled"
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action=action,
        details=f"{'Enabled' if payload.enabled else 'Disabled'} language: {name}"
    )
    
    return serialize_lang(lang)

@router.get("/logs", response_model=List[ActivityLogResponse])
async def get_activity_logs(
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    cursor = db.activity_logs.find({}).sort("timestamp", -1).limit(200)
    logs = await cursor.to_list(length=200)
    return [serialize_log(l) for l in logs]

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    # Total Users
    total_users = await db.users.count_documents({"role": "user"})
    
    # Programs Created
    programs_created = await db.programs.count_documents({})
    
    # Total Executions
    total_executions = await db.execution_history.count_documents({})
    
    # Active Users (last 7 days, distinct user_ids that executed code)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    active_user_ids = await db.execution_history.distinct(
        "user_id",
        {"executed_at": {"$gte": seven_days_ago}}
    )
    active_users = len(active_user_ids)
    
    # Most Used Language
    pipeline_lang = [
        {"$group": {"_id": "$language", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]
    lang_res = await db.execution_history.aggregate(pipeline_lang).to_list(1)
    most_used_language = lang_res[0]["_id"].capitalize() if lang_res else "None"
    
    # Daily Executions (last 7 days)
    pipeline_daily = [
        {"$match": {"executed_at": {"$gte": seven_days_ago}}},
        {
            "$project": {
                "date": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$executed_at"}
                }
            }
        },
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_res = await db.execution_history.aggregate(pipeline_daily).to_list(10)
    
    # Fill in potential missing days with 0 counts
    daily_map = {r["_id"]: r["count"] for r in daily_res}
    daily_executions = []
    
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_executions.append(
            DailyExecution(date=day, count=daily_map.get(day, 0))
        )
        
    return AnalyticsResponse(
        total_users=total_users,
        active_users=active_users,
        total_executions=total_executions,
        programs_created=programs_created,
        most_used_language=most_used_language,
        daily_executions=daily_executions
    )


# Helper to serialize challenge for admin
def serialize_challenge_admin(ch: dict) -> dict:
    ch["id"] = str(ch["_id"])
    ch.pop("_id", None)
    return ch

@router.get("/challenges", response_model=List[AdminChallengeResponse])
async def admin_get_challenges(
    search: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    query = {}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    cursor = db.coding_challenges.find(query).sort("created_at", -1)
    challenges = await cursor.to_list(length=100)
    return [serialize_challenge_admin(ch) for ch in challenges]

@router.get("/challenges/{id}", response_model=AdminChallengeResponse)
async def admin_get_challenge_by_id(
    id: str,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid challenge ID format")
    ch = await db.coding_challenges.find_one({"_id": ObjectId(id)})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return serialize_challenge_admin(ch)

@router.post("/challenges", response_model=AdminChallengeResponse)
async def admin_create_challenge(
    payload: ChallengeCreate,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    doc = payload.dict()
    doc["version"] = 1
    doc["success_rate"] = 0.0
    doc["total_submissions"] = 0
    doc["total_solves"] = 0
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    
    result = await db.coding_challenges.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action="CHALLENGE_CREATED",
        details=f"Created challenge: {payload.title} (Points: {payload.points})"
    )
    return doc

@router.put("/challenges/{id}", response_model=AdminChallengeResponse)
async def admin_update_challenge(
    id: str,
    payload: ChallengeUpdate,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid challenge ID format")
        
    existing = await db.coding_challenges.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Challenge not found")
        
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    update_data["version"] = existing.get("version", 1) + 1
    update_data["updated_at"] = datetime.utcnow()
    
    await db.coding_challenges.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    
    updated_ch = await db.coding_challenges.find_one({"_id": ObjectId(id)})
    
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action="CHALLENGE_UPDATED",
        details=f"Updated challenge: {updated_ch.get('title')} to version {updated_ch.get('version')}"
    )
    return serialize_challenge_admin(updated_ch)

@router.delete("/challenges/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_challenge(
    id: str,
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid challenge ID format")
        
    ch = await db.coding_challenges.find_one({"_id": ObjectId(id)})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
        
    await db.coding_challenges.delete_one({"_id": ObjectId(id)})
    await db.challenge_submissions.delete_many({"challenge_id": id})
    await db.user_challenge_progress.delete_many({"challenge_id": id})
    
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action="CHALLENGE_DELETED",
        details=f"Deleted challenge: {ch.get('title')}"
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/challenges/import", status_code=status.HTTP_201_CREATED)
async def admin_import_challenges(
    payload: List[ChallengeCreate],
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    docs = []
    for item in payload:
        doc = item.dict()
        doc["version"] = 1
        doc["success_rate"] = 0.0
        doc["total_submissions"] = 0
        doc["total_solves"] = 0
        doc["created_at"] = datetime.utcnow()
        doc["updated_at"] = datetime.utcnow()
        docs.append(doc)
        
    if docs:
        await db.coding_challenges.insert_many(docs)
        
    await log_activity(
        user_id=current_admin["id"],
        email=current_admin["email"],
        action="CHALLENGE_CREATED",
        details=f"Bulk imported {len(docs)} challenges."
    )
    return {"message": f"Successfully imported {len(docs)} challenges"}

@router.get("/challenges/export/all")
async def admin_export_challenges(
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    cursor = db.coding_challenges.find({})
    challenges = await cursor.to_list(length=1000)
    
    exported = []
    for ch in challenges:
        ch_doc = {**ch}
        ch_doc.pop("_id", None)
        ch_doc.pop("created_at", None)
        ch_doc.pop("updated_at", None)
        exported.append(ch_doc)
        
    return exported

@router.post("/backup")
async def trigger_db_backup(
    current_admin: dict = Depends(get_current_admin_user),
    db=Depends(get_db)
):
    try:
        collections = await db.list_collection_names()
        
        backup_data = {}
        for col_name in collections:
            cursor = db[col_name].find({})
            documents = await cursor.to_list(length=100000)
            
            serialized_docs = []
            for doc in documents:
                doc_copy = doc.copy()
                for k, v in doc_copy.items():
                    if isinstance(v, ObjectId):
                        doc_copy[k] = str(v)
                    elif isinstance(v, datetime):
                        doc_copy[k] = v.isoformat()
                    elif isinstance(v, bytes):
                        try:
                            doc_copy[k] = v.decode('utf-8')
                        except UnicodeDecodeError:
                            doc_copy[k] = v.decode('latin1')
                serialized_docs.append(doc_copy)
            backup_data[col_name] = serialized_docs
            
        json_str = json.dumps(backup_data, default=str)
        
        compressed_file = BytesIO()
        with gzip.GzipFile(fileobj=compressed_file, mode='w') as f:
            f.write(json_str.encode('utf-8'))
            
        compressed_file.seek(0)
        
        await log_activity(
            user_id=current_admin["id"],
            email=current_admin["email"],
            action="DATABASE_BACKUP",
            details="Triggered manual database backup from admin panel"
        )
        
        filename = f"mongodb_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json.gz"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
        return StreamingResponse(compressed_file, media_type="application/gzip", headers=headers)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")
