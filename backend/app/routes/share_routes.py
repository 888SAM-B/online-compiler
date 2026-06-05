import secrets
import gzip
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_user, log_activity
from app.models import (
    CreateShareRequest,
    UpdateShareRequest,
    ShareResponse,
    ShareAnalyticsResponse
)

router = APIRouter(prefix="/share", tags=["share"])

def serialize_share(share: dict) -> dict:
    share_copy = share.copy()
    share_copy["id"] = str(share_copy["_id"])
    share_copy.pop("_id", None)
    
    # Decompress source code if it's stored as gzip compressed bytes
    if isinstance(share_copy.get("source_code"), bytes):
        try:
            share_copy["source_code"] = gzip.decompress(share_copy["source_code"]).decode("utf-8")
        except Exception:
            pass  # Fallback if decompression fails
            
    return share_copy

def get_client_ip(request: Request) -> str:
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

async def get_optional_user(request: Request, db=Depends(get_db)) -> Optional[dict]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    
    # Lazy import settings and jwt to avoid any potential circular imports
    from app.config import settings
    from jose import jwt
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        is_refresh = payload.get("refresh", False)
        if email is None or is_refresh or not user_id:
            return None
            
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            user["id"] = str(user["_id"])
            return user
    except Exception:
        return None
    return None

@router.post("", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def create_share(
    share_in: CreateShareRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    # Rate Limit Check: max 20 shares per user per 24 hours
    time_limit = datetime.utcnow() - timedelta(days=1)
    shares_count = await db.shared_codes.count_documents({
        "user_id": current_user["id"],
        "created_at": {"$gte": time_limit}
    })
    if shares_count >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. You can create up to 20 shares per 24 hours."
        )

    # Validate language
    lang = await db.supported_languages.find_one({"name": share_in.language, "enabled": True})
    if not lang:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{share_in.language}' is not supported or is currently disabled"
        )

    # Challenge Solution Visibility Override: If it's a challenge solution, force to "unlisted"
    visibility = share_in.visibility
    if share_in.is_challenge_solution:
        visibility = "unlisted"

    # Expiration datetime calculation
    expires_at = None
    if share_in.expires_in_hours is not None:
        expires_at = datetime.utcnow() + timedelta(hours=share_in.expires_in_hours)

    # Gzip compress the source code
    compressed_code = gzip.compress(share_in.source_code.encode("utf-8"))

    # Generate token_urlsafe(12) => ~16 chars
    share_id = secrets.token_urlsafe(12)

    new_share = {
        "share_id": share_id,
        "user_id": current_user["id"],
        "title": share_in.title,
        "description": share_in.description,
        "language": share_in.language,
        "source_code": compressed_code,
        "visibility": visibility,
        "editor_version": 1,
        "original_share_id": None,
        "views": 0,
        "forks": 0,
        "link_copies": 0,
        "likes": 0,
        "bookmarks": 0,
        "featured": False,
        "approved": False,
        "challenge_id": share_in.challenge_id,
        "is_challenge_solution": bool(share_in.is_challenge_solution),
        "is_active": True,
        "expires_at": expires_at,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.shared_codes.insert_one(new_share)

    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="CODE_SHARED",
        details=f"Shared code snippet: {share_in.title} (ID: {share_id})"
    )

    return serialize_share(new_share)

@router.get("/my", response_model=List[ShareResponse])
async def get_my_shares(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    cursor = db.shared_codes.find({
        "user_id": current_user["id"],
        "is_active": True
    }).sort("created_at", -1)
    
    shares = await cursor.to_list(length=100)
    return [serialize_share(s) for s in shares]

@router.get("/my/analytics", response_model=ShareAnalyticsResponse)
async def get_my_share_analytics(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    shares = await db.shared_codes.find({
        "user_id": current_user["id"],
        "is_active": True
    }).to_list(length=10000)

    if not shares:
        return ShareAnalyticsResponse(
            total_shares=0,
            total_views=0,
            total_forks=0,
            average_views=0.0,
            most_viewed=None,
            most_forked=None
        )

    total_shares = len(shares)
    total_views = sum(s.get("views", 0) for s in shares)
    total_forks = sum(s.get("forks", 0) for s in shares)
    average_views = round(total_views / total_shares, 2) if total_shares > 0 else 0.0

    most_viewed_share = max(shares, key=lambda s: s.get("views", 0))
    most_forked_share = max(shares, key=lambda s: s.get("forks", 0))

    return ShareAnalyticsResponse(
        total_shares=total_shares,
        total_views=total_views,
        total_forks=total_forks,
        average_views=average_views,
        most_viewed=most_viewed_share.get("title") if most_viewed_share and most_viewed_share.get("views", 0) > 0 else None,
        most_forked=most_forked_share.get("title") if most_forked_share and most_forked_share.get("forks", 0) > 0 else None
    )

@router.get("/{share_id}", response_model=ShareResponse)
async def get_share(
    share_id: str,
    request: Request,
    optional_user: Optional[dict] = Depends(get_optional_user),
    db=Depends(get_db)
):
    share = await db.shared_codes.find_one({"share_id": share_id, "is_active": True})
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet not found")

    # Check if expired
    if share.get("expires_at") and share["expires_at"] < datetime.utcnow():
        # Soft delete or hard delete it
        await db.shared_codes.delete_one({"share_id": share_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet has expired")

    # Access control: private shares only viewable by owner
    if share["visibility"] == "private":
        if not optional_user or share["user_id"] != optional_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # View Counter Abuse Prevention: 1 IP -> 1 View -> Every 24 Hours
    ip_address = get_client_ip(request)
    time_limit = datetime.utcnow() - timedelta(hours=24)
    
    existing_log = await db.share_access_logs.find_one({
        "share_id": share_id,
        "ip_address": ip_address,
        "action": "VIEW",
        "timestamp": {"$gte": time_limit}
    })

    if not existing_log:
        # Increment view count in database
        await db.shared_codes.update_one(
            {"share_id": share_id},
            {"$inc": {"views": 1}}
        )
        share["views"] += 1

    # Log the access attempt (either primary or secondary)
    await db.share_access_logs.insert_one({
        "share_id": share_id,
        "user_id": optional_user["id"] if optional_user else None,
        "ip_address": ip_address,
        "action": "VIEW",
        "timestamp": datetime.utcnow()
    })

    return serialize_share(share)

@router.post("/{share_id}/copy")
async def track_copy(
    share_id: str,
    request: Request,
    optional_user: Optional[dict] = Depends(get_optional_user),
    db=Depends(get_db)
):
    share = await db.shared_codes.find_one({"share_id": share_id, "is_active": True})
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet not found")

    # Increment copy counter
    await db.shared_codes.update_one(
        {"share_id": share_id},
        {"$inc": {"link_copies": 1}}
    )

    # Log copy action
    await db.share_access_logs.insert_one({
        "share_id": share_id,
        "user_id": optional_user["id"] if optional_user else None,
        "ip_address": get_client_ip(request),
        "action": "COPY",
        "timestamp": datetime.utcnow()
    })

    return {"success": True, "message": "Link copy tracked successfully"}

@router.post("/{share_id}/fork", response_model=dict)
async def fork_share(
    share_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    share = await db.shared_codes.find_one({"share_id": share_id, "is_active": True})
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet not found")

    # Check if expired
    if share.get("expires_at") and share["expires_at"] < datetime.utcnow():
        await db.shared_codes.delete_one({"share_id": share_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet has expired")

    # Fork Prevention for Own Snippets
    if share["user_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot fork your own shared code snippet."
        )

    # Decompress code for copying into program
    source_code = share["source_code"]
    if isinstance(source_code, bytes):
        source_code = gzip.decompress(source_code).decode("utf-8")

    # Create program copy in current user's programs collection
    new_program = {
        "user_id": current_user["id"],
        "title": f"Fork of {share['title']}",
        "language": share["language"],
        "source_code": source_code,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.programs.insert_one(new_program)
    new_program["id"] = str(result.inserted_id)
    new_program.pop("_id", None)

    # Increment forks count on original share
    await db.shared_codes.update_one(
        {"share_id": share_id},
        {"$inc": {"forks": 1}}
    )

    # Log fork action in access logs
    await db.share_access_logs.insert_one({
        "share_id": share_id,
        "user_id": current_user["id"],
        "ip_address": get_client_ip(request),
        "action": "FORK",
        "timestamp": datetime.utcnow()
    })

    # Log user activity
    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="CODE_FORKED",
        details=f"Forked shared snippet ID {share_id} to program: {new_program['title']}"
    )

    return new_program

@router.put("/{share_id}", response_model=ShareResponse)
async def update_share(
    share_id: str,
    share_in: UpdateShareRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    share = await db.shared_codes.find_one({"share_id": share_id, "is_active": True})
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet not found")

    if share["user_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_fields = {}
    if share_in.title is not None:
        update_fields["title"] = share_in.title
    if share_in.description is not None:
        update_fields["description"] = share_in.description
    if share_in.visibility is not None:
        # If it's a challenge solution, force visibility to "unlisted"
        if share.get("is_challenge_solution") and share_in.visibility != "unlisted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge solution visibility must remain unlisted to prevent leaks."
            )
        update_fields["visibility"] = share_in.visibility

    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        await db.shared_codes.update_one(
            {"share_id": share_id},
            {"$set": update_fields}
        )
        
        # Log activity
        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="CODE_SHARED_UPDATED",
            details=f"Updated shared snippet details (ID: {share_id})"
        )

        share = await db.shared_codes.find_one({"share_id": share_id})

    return serialize_share(share)

@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_share(
    share_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    share = await db.shared_codes.find_one({"share_id": share_id, "is_active": True})
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared snippet not found")

    if share["user_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Hard delete from MongoDB
    await db.shared_codes.delete_one({"share_id": share_id})
    # Clean up corresponding logs
    await db.share_access_logs.delete_many({"share_id": share_id})

    # Log activity
    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="CODE_SHARED_DELETED",
        details=f"Deleted shared snippet (ID: {share_id})"
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
