import logging
from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_user, log_activity
from app.models import ExplainCodeRequest, DebugCodeRequest, GenerateCodeRequest, SuggestCodeRequest
from app.services import ai_service, copilot_service

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)

async def check_daily_limit(user_id: str, db):
    """
    Checks if the user has reached their daily limit of 50 AI requests (excluding inline suggestions).
    """
    today_start = datetime.combine(datetime.utcnow().date(), time.min)
    user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    count = await db.ai_usage_logs.count_documents({
        "user_id": user_oid,
        "feature": {"$ne": "AI_INLINE_SUGGESTION"},
        "created_at": {"$gte": today_start}
    })
    
    if count >= 50:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI limit exceeded."
        )

@router.post("/explain")
async def explain_code(payload: ExplainCodeRequest, request: Request, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    
    # 1. Reject empty requests
    if not payload.code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty.")
        
    # 2. Check daily rate limiting (50 requests per day)
    await check_daily_limit(current_user["id"], db)
    
    # 3. Call AI Service and handle errors gracefully
    try:
        explanation = await ai_service.generate_explanation(
            code=payload.code,
            language=payload.language,
            user_id=current_user["id"],
            email=current_user["email"],
            ip_address=ip
        )
        
        # Log to activity logs
        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="AI_CODE_EXPLAIN",
            details=f"Code explanation generated for {payload.language}",
            ip_address=ip
        )
        
        return {"success": True, "explanation": explanation}
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"AI Explain error: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"success": False, "message": "AI service temporarily unavailable"}
        )

@router.post("/debug")
async def debug_code(payload: DebugCodeRequest, request: Request, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    
    # 1. Reject empty requests
    if not payload.code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty.")
        
    # 2. Check daily rate limiting (50 requests per day)
    await check_daily_limit(current_user["id"], db)
    
    # 3. Call AI Service and handle errors gracefully
    try:
        issues_result = await ai_service.debug_code(
            code=payload.code,
            language=payload.language,
            user_id=current_user["id"],
            email=current_user["email"],
            ip_address=ip
        )
        
        # Log to activity logs
        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="AI_CODE_DEBUG",
            details=f"Code debugged for {payload.language}",
            ip_address=ip
        )
        
        return {"success": True, "issues": issues_result.get("issues", [])}
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"AI Debug error: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"success": False, "message": "AI service temporarily unavailable"}
        )


@router.post("/generate")
async def generate_code(payload: GenerateCodeRequest, request: Request, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    
    # 1. Reject empty requests
    if not payload.prompt.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prompt cannot be empty.")
        
    # 2. Check daily rate limiting (50 requests per day)
    await check_daily_limit(current_user["id"], db)
    
    # 3. Call AI Service and handle errors gracefully
    try:
        generated_code = await ai_service.generate_code(
            user_prompt=payload.prompt,
            language=payload.language,
            user_id=current_user["id"],
            email=current_user["email"],
            ip_address=ip
        )
        
        # Log to activity logs
        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="AI_CODE_GENERATE",
            details=f"Code generated for {payload.language}",
            ip_address=ip
        )
        
        return {"success": True, "generated_code": generated_code}
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"AI Generate error: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"success": False, "message": "AI service temporarily unavailable"}
        )

async def check_suggestion_limit(user_id: str, db):
    """
    Checks if the user has reached their daily limit of 200 inline code suggestions.
    """
    today_start = datetime.combine(datetime.utcnow().date(), time.min)
    user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    count = await db.ai_usage_logs.count_documents({
        "user_id": user_oid,
        "feature": "AI_INLINE_SUGGESTION",
        "created_at": {"$gte": today_start}
    })
    return count < 200

@router.post("/suggest")
async def suggest_code_completion(
    payload: SuggestCodeRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    ip = request.client.host if request.client else "unknown"
    
    # 1. Check suggestion daily limit (200 requests/day)
    if not await check_suggestion_limit(current_user["id"], db):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"success": False, "message": "Daily AI suggestion limit exceeded."}
        )
        
    # 2. Call Copilot Service
    try:
        result = await copilot_service.generate_inline_suggestion(
            code=payload.code,
            language=payload.language,
            cursor_position=payload.cursor_position,
            user_id=current_user["id"],
            email=current_user["email"],
            ip_address=ip
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"AI Suggestion error: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"success": False, "message": "AI suggestion unavailable."}
        )
