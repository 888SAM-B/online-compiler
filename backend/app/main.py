import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routes import auth_routes, program_routes, execute_routes, admin_routes, ai_routes, challenge_routes, share_routes, assessment_routes, admin_assessment_routes


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB and seed data
    logger.info("Initializing application and database...")
    await init_db()
    yield
    # Shutdown: Clean up resources if necessary
    logger.info("Shutting down application...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_routes.router, prefix=settings.API_V1_STR)
app.include_router(program_routes.router, prefix=settings.API_V1_STR)
app.include_router(execute_routes.router, prefix=settings.API_V1_STR)
app.include_router(admin_routes.router, prefix=settings.API_V1_STR)
app.include_router(ai_routes.router, prefix=settings.API_V1_STR)
app.include_router(challenge_routes.router, prefix=settings.API_V1_STR)
app.include_router(share_routes.router, prefix=settings.API_V1_STR)
app.include_router(assessment_routes.router, prefix=settings.API_V1_STR)
app.include_router(admin_assessment_routes.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the Web-Based Online Compiler API",
        "docs": "/docs"
    }
