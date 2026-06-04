from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from datetime import datetime
from jose import JWTError, jwt
from bson import ObjectId

from app.config import settings
from app.database import get_db
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    log_activity
)
from app.models import (
    UserRegister,
    UserLogin,
    Token,
    UserResponse,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest
)
import hashlib
import secrets
from datetime import timedelta
from app.services import email_service

router = APIRouter(prefix="/auth", tags=["auth"])

def serialize_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    # Do not return the hashed password in JSON responses
    user.pop("password", None)
    user.pop("_id", None)
    return user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, request: Request, background_tasks: BackgroundTasks, db=Depends(get_db)):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
        
    # Create new user document
    new_user = {
        "name": user_in.name,
        "email": user_in.email,
        "password": hash_password(user_in.password),
        "role": "user",  # Default role
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    
    # Log registration activity
    await log_activity(
        user_id=str(new_user["_id"]),
        email=new_user["email"],
        action="user_registered",
        details="User registered successfully",
        ip_address=request.client.host if request.client else None
    )
    
    # Send welcome email in background
    background_tasks.add_task(email_service.send_welcome_email, new_user["email"], new_user["name"])
    
    return serialize_user(new_user)

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request, db=Depends(get_db)):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.get("is_blocked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked. Please contact the administrator."
        )
        
    # Generate tokens
    token_data = {
        "sub": user["email"],
        "role": user.get("role", "user"),
        "user_id": str(user["_id"])
    }
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)
    
    # Update updated_at
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"updated_at": datetime.utcnow()}}
    )
    
    # Log login activity
    await log_activity(
        user_id=str(user["_id"]),
        email=user["email"],
        action="user_login",
        details="User logged in successfully",
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(payload: dict, db=Depends(get_db)):
    ref_token = payload.get("refresh_token")
    if not ref_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required"
        )
        
    try:
        token_payload = jwt.decode(ref_token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        email: str = token_payload.get("sub")
        role: str = token_payload.get("role")
        user_id: str = token_payload.get("user_id")
        is_refresh = token_payload.get("refresh", False)
        
        if email is None or not is_refresh:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user.get("is_blocked", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive or blocked")
        
    token_data = {
        "sub": user["email"],
        "role": user.get("role", "user"),
        "user_id": str(user["_id"])
    }
    
    access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data=token_data)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)

@router.put("/me", response_model=UserResponse)
async def update_me(payload: dict, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    name = payload.get("name")
    password = payload.get("password")
    
    update_data = {}
    if name is not None:
        if len(name) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Name must be at least 2 characters"
            )
        update_data["name"] = name
        
    if password:
        if len(password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Password must be at least 6 characters"
            )
        update_data["password"] = hash_password(password)
        
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": update_data})
        
        # Log profile update
        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="profile_updated",
            details="User updated profile name/password"
        )
        
        fresh_user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        return serialize_user(fresh_user)
        
    return serialize_user(current_user)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db=Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    email = payload.email.lower()
    
    # Rate limit check: last 1 hour
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    
    # 1. Check rate limits by email (max 3 per hour)
    email_request_count = await db.password_reset_otps.count_documents({
        "email": email,
        "created_at": {"$gte": one_hour_ago}
    })
    if email_request_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests for this email. Please try again later."
        )
        
    # 2. Check rate limits by IP (max 5 per hour)
    ip_request_count = await db.password_reset_otps.count_documents({
        "ip_address": ip,
        "created_at": {"$gte": one_hour_ago}
    })
    if ip_request_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests from this IP. Please try again later."
        )
        
    # Check if user exists (Email Enumeration Protection)
    user = await db.users.find_one({"email": email})
    
    if user:
        # Generate 6-digit secure numeric OTP
        otp = "".join(secrets.choice("0123456789") for _ in range(6))
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()
        
        # Store in MongoDB
        otp_record = {
            "email": email,
            "otp_hash": otp_hash,
            "used": False,
            "attempts": 0,
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "created_at": datetime.utcnow(),
            "ip_address": ip
        }
        await db.password_reset_otps.insert_one(otp_record)
        
        # Send OTP email via Brevo SMTP
        email_sent = await email_service.send_otp_email(email, otp)
        if not email_sent:
            # We fail gracefully or log it. But we should log that sending failed.
            pass
            
        # Log activity
        await log_activity(
            user_id=str(user["_id"]),
            email=email,
            action="PASSWORD_RESET_REQUEST",
            details="Password reset OTP requested",
            ip_address=ip
        )
        
    # Always return generic success response
    return {"message": "If the account exists, an OTP has been sent."}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest, request: Request, db=Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    email = payload.email.lower()
    otp = payload.otp
    
    # Find latest active OTP record for this email
    record = await db.password_reset_otps.find_one(
        {"email": email, "used": False, "expires_at": {"$gt": datetime.utcnow()}},
        sort=[("created_at", -1)]
    )
    
    if not record:
        await log_activity(
            user_id=None,
            email=email,
            action="OTP_VERIFICATION_FAILED",
            details="Invalid or expired OTP (No record found)",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    # Increment attempts
    await db.password_reset_otps.update_one(
        {"_id": record["_id"]},
        {"$inc": {"attempts": 1}}
    )
    
    if record.get("attempts", 0) + 1 > 5:
        await log_activity(
            user_id=None,
            email=email,
            action="OTP_VERIFICATION_FAILED",
            details="Too many OTP verification attempts",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many failed attempts. Please request a new OTP."
        )
        
    # Hash incoming OTP and match
    incoming_hash = hashlib.sha256(otp.encode()).hexdigest()
    if incoming_hash != record["otp_hash"]:
        await log_activity(
            user_id=None,
            email=email,
            action="OTP_VERIFICATION_FAILED",
            details="Invalid OTP entered",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    return {"valid": True}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, request: Request, db=Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    email = payload.email.lower()
    otp = payload.otp
    new_password = payload.new_password
    
    # 1. Password validation
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
        
    # 2. Find latest active OTP record
    record = await db.password_reset_otps.find_one(
        {"email": email, "used": False, "expires_at": {"$gt": datetime.utcnow()}},
        sort=[("created_at", -1)]
    )
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    # 3. Check attempts limit
    if record.get("attempts", 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many failed attempts. Please request a new OTP."
        )
        
    # 4. Verify OTP matches hash and increment attempts on failure
    incoming_hash = hashlib.sha256(otp.encode()).hexdigest()
    if incoming_hash != record["otp_hash"]:
        await db.password_reset_otps.update_one(
            {"_id": record["_id"]},
            {"$inc": {"attempts": 1}}
        )
        if record.get("attempts", 0) + 1 > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Please request a new OTP."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    # 5. Lookup user
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
        
    # 6. Update user password
    hashed_pwd = hash_password(new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hashed_pwd, "updated_at": datetime.utcnow()}}
    )
    
    # 7. Mark OTP as used
    await db.password_reset_otps.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )
    
    # 8. Send reset success email
    await email_service.send_reset_success_email(email)
    
    # 9. Log activity
    await log_activity(
        user_id=str(user["_id"]),
        email=email,
        action="PASSWORD_RESET_SUCCESS",
        details="Password reset successfully completed",
        ip_address=ip
    )
    
    return {"message": "Password reset successful"}

