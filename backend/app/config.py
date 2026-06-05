import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Online Compiler Platform"
    API_V1_STR: str = "/api"
    
    # Database
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DB_NAME: str = "online_compiler"
    REDIS_URI: str = os.getenv("REDIS_URI", "redis://localhost:6379")

    
    # SMTP Settings (Brevo)
    BREVO_SMTP_HOST: str = os.getenv("BREVO_SMTP_HOST", "")
    BREVO_SMTP_PORT: int = int(os.getenv("BREVO_SMTP_PORT", "587"))
    BREVO_SMTP_USER: str = os.getenv("BREVO_SMTP_USER", "")
    BREVO_SMTP_PASSWORD: str = os.getenv("BREVO_SMTP_PASSWORD", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "")
    SUPPRESS_SEND: bool = os.getenv("SUPPRESS_SEND", "False").lower() in ("true", "1", "t")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_EXPIRE: int = int(os.getenv("JWT_EXPIRE", "30"))  # Access token expiry in minutes
    JWT_REFRESH_EXPIRE_DAYS: int = 7  # Refresh token expiry in days
    ALGORITHM: str = "HS256"
    
    # Docker Executor settings
    DOCKER_HOST: str = os.getenv("DOCKER_HOST", "")  # Empty string lets Docker SDK auto-detect
    
    # Execution Limits
    CPU_LIMIT: float = 1.0
    MEM_LIMIT: str = "256m"
    TIMEOUT_LIMIT: float = 5.0
    DISK_LIMIT: str = "50m"

    class Config:
        env_file = (".env", "../.env")
        case_sensitive = True

settings = Settings()
