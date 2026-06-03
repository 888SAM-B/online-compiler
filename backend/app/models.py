from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Authentication Models ---

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str  # email
    role: str
    user_id: str
    exp: float

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_blocked: bool
    created_at: datetime
    updated_at: datetime

# --- Program Models ---

class ProgramCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    language: str
    source_code: str

class ProgramUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    language: Optional[str] = None
    source_code: Optional[str] = None

class ProgramResponse(BaseModel):
    id: str
    user_id: str
    title: str
    language: str
    source_code: str
    created_at: datetime
    updated_at: datetime

# --- Execution Models ---

class ExecuteRequest(BaseModel):
    code: str
    language: str
    program_id: Optional[str] = None

class ExecuteResponse(BaseModel):
    success: bool
    output: str
    error: str
    execution_time: float

class ExecutionHistoryResponse(BaseModel):
    id: str
    user_id: str
    program_id: Optional[str] = None
    language: str
    source_code: str
    output: str
    error: str
    execution_time: float
    status: str
    executed_at: datetime

# --- Admin Models ---

class LanguageStatusUpdate(BaseModel):
    name: str
    enabled: bool

class LanguageResponse(BaseModel):
    id: str
    name: str
    display_name: str
    enabled: bool
    docker_image: str
    filename: str
    compile_cmd: str
    run_cmd: str

class ActivityLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    action: str
    details: str
    ip_address: Optional[str] = None
    timestamp: datetime

class DailyExecution(BaseModel):
    date: str
    count: int

class AnalyticsResponse(BaseModel):
    total_users: int
    active_users: int
    total_executions: int
    programs_created: int
    most_used_language: str
    daily_executions: List[DailyExecution]
