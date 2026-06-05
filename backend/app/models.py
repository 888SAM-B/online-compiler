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

# --- Password Reset Models ---

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


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


# --- AI Assistant Models ---

class ExplainCodeRequest(BaseModel):
    language: str
    code: str = Field(..., max_length=20000)

class DebugCodeRequest(BaseModel):
    language: str
    code: str = Field(..., max_length=20000)

class GenerateCodeRequest(BaseModel):
    language: str
    prompt: str = Field(..., max_length=20000)

class SuggestCodeRequest(BaseModel):
    language: str
    code: str = Field(..., max_length=5000)
    cursor_position: int


# --- Coding Challenge Models ---

class TestCaseSchema(BaseModel):
    input: str
    expected_output: str

class ChallengeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    difficulty: str  # Easy, Medium, Hard
    category: str    # Arrays, Strings, Math, Loops, Functions, Recursion, Searching, Sorting
    tags: List[str] = []
    problem_statement: str
    input_format: str
    output_format: str
    constraints: str
    sample_input: str
    sample_output: str
    estimated_time_minutes: int = 15
    supported_languages: List[str] = ["python", "javascript", "c", "cpp", "java"]
    starter_code: Dict[str, str] = {}
    sample_test_cases: List[TestCaseSchema] = []
    hidden_test_cases: List[TestCaseSchema] = []
    points: int = 100
    status: str = "draft"  # draft, active, archived

class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    problem_statement: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    estimated_time_minutes: Optional[int] = None
    supported_languages: Optional[List[str]] = None
    starter_code: Optional[Dict[str, str]] = None
    sample_test_cases: Optional[List[TestCaseSchema]] = None
    hidden_test_cases: Optional[List[TestCaseSchema]] = None
    points: Optional[int] = None
    status: Optional[str] = None

class ChallengeResponse(BaseModel):
    id: str
    title: str
    version: int
    status: str
    difficulty: str
    category: str
    tags: List[str]
    problem_statement: str
    input_format: str
    output_format: str
    constraints: str
    sample_input: str
    sample_output: str
    estimated_time_minutes: int
    supported_languages: List[str]
    starter_code: Dict[str, str]
    sample_test_cases: List[TestCaseSchema]
    points: int
    success_rate: float
    total_submissions: int
    total_solves: int
    created_at: datetime
    updated_at: datetime

class AdminChallengeResponse(ChallengeResponse):
    hidden_test_cases: List[TestCaseSchema]

class ChallengeSubmitRequest(BaseModel):
    language: str
    source_code: str = Field(..., max_length=100000)

class TestCaseResult(BaseModel):
    passed: bool
    execution_time_ms: float
    error: Optional[str] = None

class ChallengeSubmitResponse(BaseModel):
    passed: bool
    passed_test_cases: int
    total_test_cases: int
    score: float
    test_case_results: List[TestCaseResult]

class ChallengeRunResult(BaseModel):
    passed: bool
    input: str
    expected_output: str
    actual_output: str
    execution_time_ms: float
    error: Optional[str] = None

class ChallengeRunResponse(BaseModel):
    success: bool
    results: List[ChallengeRunResult]

class ChallengeSubmissionResponse(BaseModel):
    id: str
    user_id: str
    challenge_id: str
    challenge_version: int
    language: str
    source_code: str
    code_size: int
    passed_test_cases: int
    total_test_cases: int
    test_case_results: List[TestCaseResult]
    status: str
    score: float
    execution_time_ms: float
    submitted_at: datetime

class LeaderboardEntry(BaseModel):
    user_id: str
    username: str
    email: str
    total_score: float
    solved_challenges: int

class LeaderboardResponse(BaseModel):
    leaderboard: List[LeaderboardEntry]

class AchievementResponse(BaseModel):
    achievement_type: str
    unlocked_at: datetime

class ChallengeProgressResponse(BaseModel):
    total_challenges: int
    total_solved: int
    easy_solved: int
    medium_solved: int
    hard_solved: int
    total_score: float
    success_rate: float
    best_language: str
    global_rank: int
    achievements: List[AchievementResponse]


# --- Code Sharing Models ---

class CreateShareRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    language: str
    source_code: str = Field(..., max_length=102400)  # Max 100KB
    visibility: str = Field("unlisted")  # public, unlisted, private
    expires_in_hours: Optional[int] = None
    challenge_id: Optional[str] = None
    is_challenge_solution: Optional[bool] = False

class UpdateShareRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[str] = None  # public, unlisted, private

class ShareResponse(BaseModel):
    share_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    language: str
    source_code: str
    visibility: str
    editor_version: int = 1
    original_share_id: Optional[str] = None
    views: int = 0
    forks: int = 0
    link_copies: int = 0
    likes: int = 0
    bookmarks: int = 0
    featured: bool = False
    approved: bool = False
    challenge_id: Optional[str] = None
    is_challenge_solution: bool = False
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class ShareAnalyticsResponse(BaseModel):
    total_shares: int
    total_views: int
    total_forks: int
    average_views: float
    most_viewed: Optional[str] = None
    most_forked: Optional[str] = None


# --- Assessments & Certification Models ---

class AssessmentResponse(BaseModel):
    id: str
    title: str
    description: str
    assessment_type: str
    language: str
    duration_minutes: int
    questions_per_attempt: int
    passing_percentage: int
    max_attempts: int
    cooldown_hours: int
    active: bool

class QuestionResponse(BaseModel):
    id: str
    question_text: str
    options: List[str]

class AttemptStartResponse(BaseModel):
    attempt_id: str
    assessment_title: str
    duration_minutes: int
    expires_at: datetime
    questions: List[QuestionResponse]
    answers: Optional[List[Dict[str, Any]]] = None

class SaveAnswerRequest(BaseModel):
    question_id: str
    selected_answer: Optional[str] = None

class AttemptSubmitRequest(BaseModel):
    answers: Optional[List[Dict[str, Any]]] = None

class AttemptSubmitResponse(BaseModel):
    attempt_id: str
    passed: bool
    score: int
    percentage: float
    badge: str
    certificate_id: Optional[str] = None
    unlocked_achievements: List[str]

class CertificateResponse(BaseModel):
    id: str
    certificate_id: str
    assessment_title: str
    badge: str
    percentage: float
    issued_at: datetime
    attempt_id: Optional[str] = None

class CertificateVerifyResponse(BaseModel):
    valid: bool
    certificate_id: str
    user_name: str
    assessment_title: str
    badge: str
    percentage: float
    issued_at: datetime
    revoked: bool
    revoked_reason: Optional[str] = None

class AdminAssessmentAnalyticsResponse(BaseModel):
    total_attempts: int
    pass_rate: float
    average_score: float
    gold_badges: int
    silver_badges: int
    bronze_badges: int
    certificates_generated: int





