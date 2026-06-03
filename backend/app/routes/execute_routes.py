from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_user, log_activity
from app.executor import execute_code
from app.models import ExecuteRequest, ExecuteResponse, ExecutionHistoryResponse

router = APIRouter(tags=["execution"])

def serialize_history(history: dict) -> dict:
    history["id"] = str(history["_id"])
    history.pop("_id", None)
    return history

@router.post("/execute", response_model=ExecuteResponse)
async def run_code(exec_req: ExecuteRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    # 1. Fetch language specifications and check if enabled
    lang_info = await db.supported_languages.find_one({"name": exec_req.language})
    if not lang_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{exec_req.language}' is not supported on this platform."
        )
    if not lang_info.get("enabled", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{exec_req.language}' is currently disabled by the administrator."
        )
        
    # 2. Run execution engine
    result = await execute_code(lang_info, exec_req.code)
    
    # 3. Store in execution history
    history_entry = {
        "user_id": current_user["id"],
        "program_id": exec_req.program_id,
        "language": exec_req.language,
        "source_code": exec_req.code,
        "output": result["output"],
        "error": result["error"],
        "execution_time": result["execution_time"],
        "status": "success" if result["success"] else ("timeout" if "Timeout" in result["error"] else "error"),
        "executed_at": datetime.utcnow()
    }
    await db.execution_history.insert_one(history_entry)
    
    # 4. Log the execution activity
    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="code_execution",
        details=f"Executed {exec_req.language} code (Status: {history_entry['status']})"
    )
    
    return result

@router.get("/history", response_model=List[ExecutionHistoryResponse])
async def get_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    cursor = db.execution_history.find({"user_id": current_user["id"]}).sort("executed_at", -1)
    history = await cursor.to_list(length=100)
    return [serialize_history(h) for h in history]
