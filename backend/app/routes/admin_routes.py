from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_admin_user, log_activity
from app.models import (
    UserResponse,
    AnalyticsResponse,
    DailyExecution,
    LanguageResponse,
    LanguageStatusUpdate,
    ActivityLogResponse
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
