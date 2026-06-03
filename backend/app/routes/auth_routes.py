from fastapi import APIRouter, Depends, HTTPException, status, Request
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
from app.models import UserRegister, UserLogin, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

def serialize_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    # Do not return the hashed password in JSON responses
    user.pop("password", None)
    user.pop("_id", None)
    return user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, request: Request, db=Depends(get_db)):
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

