from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import List
from datetime import datetime
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_user, log_activity
from app.models import ProgramCreate, ProgramUpdate, ProgramResponse

router = APIRouter(prefix="/programs", tags=["programs"])

def serialize_program(program: dict) -> dict:
    program["id"] = str(program["_id"])
    program.pop("_id", None)
    return program

@router.get("", response_model=List[ProgramResponse])
async def get_programs(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    cursor = db.programs.find({"user_id": current_user["id"]}).sort("updated_at", -1)
    programs = await cursor.to_list(length=100)
    return [serialize_program(p) for p in programs]

@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(program_in: ProgramCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    # Validate language
    lang = await db.supported_languages.find_one({"name": program_in.language, "enabled": True})
    if not lang:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{program_in.language}' is not supported or is currently disabled"
        )
        
    new_program = {
        "user_id": current_user["id"],
        "title": program_in.title,
        "language": program_in.language,
        "source_code": program_in.source_code,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.programs.insert_one(new_program)
    new_program["_id"] = result.inserted_id
    
    # Log program creation
    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="program_created",
        details=f"Created program: {program_in.title} ({program_in.language})"
    )
    
    return serialize_program(new_program)

@router.get("/{id}", response_model=ProgramResponse)
async def get_program(id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid program ID format")
        
    program = await db.programs.find_one({"_id": ObjectId(id)})
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        
    # Check ownership (allow admin to view for support/moderation if needed, or strictly owner)
    if program["user_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    return serialize_program(program)

@router.put("/{id}", response_model=ProgramResponse)
async def update_program(id: str, program_in: ProgramUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid program ID format")
        
    program = await db.programs.find_one({"_id": ObjectId(id)})
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        
    if program["user_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    update_data = {}
    if program_in.title is not None:
        update_data["title"] = program_in.title
    if program_in.language is not None:
        # Validate language
        lang = await db.supported_languages.find_one({"name": program_in.language, "enabled": True})
        if not lang:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Language '{program_in.language}' is not supported or disabled"
            )
        update_data["language"] = program_in.language
    if program_in.source_code is not None:
        update_data["source_code"] = program_in.source_code
        
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.programs.update_one({"_id": ObjectId(id)}, {"$set": update_data})
        
        # Log update
        await log_activity(
            user_id=current_user["id"],
            email=current_user["email"],
            action="program_updated",
            details=f"Updated program ID: {id}"
        )
        
        # Retrieve fresh document
        program = await db.programs.find_one({"_id": ObjectId(id)})
        
    return serialize_program(program)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid program ID format")
        
    program = await db.programs.find_one({"_id": ObjectId(id)})
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        
    if program["user_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    await db.programs.delete_one({"_id": ObjectId(id)})
    
    # Log deletion
    await log_activity(
        user_id=current_user["id"],
        email=current_user["email"],
        action="program_deleted",
        details=f"Deleted program: {program.get('title')} (ID: {id})"
    )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)
