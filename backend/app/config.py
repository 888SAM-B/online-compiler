import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Online Compiler Platform"
    API_V1_STR: str = "/api"
    
    # Database
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DB_NAME: str = "online_compiler"
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-that-should-be-changed-in-production-1234567890")
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
        case_sensitive = True

settings = Settings()
