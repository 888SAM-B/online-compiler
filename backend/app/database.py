import logging
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime
from app.config import settings
from app.utils.challenge_seeder import seed_challenges
from app.utils.assessment_seeder import seed_assessments

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

def get_db():
    return db_instance.db

async def init_db():
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGO_URI)
        db_instance.db = db_instance.client[settings.DB_NAME]
        
        # Verify connection
        await db_instance.client.admin.command('ping')
        logger.info("Successfully connected to MongoDB!")
        
        # Create indexes
        await db_instance.db.users.create_index("email", unique=True)
        await db_instance.db.programs.create_index("user_id")
        await db_instance.db.execution_history.create_index("user_id")
        await db_instance.db.execution_history.create_index("executed_at")
        await db_instance.db.activity_logs.create_index("timestamp")
        await db_instance.db.password_reset_otps.create_index("expires_at", expireAfterSeconds=0)
        await db_instance.db.password_reset_otps.create_index("email")
        await db_instance.db.ai_usage_logs.create_index("created_at")
        await db_instance.db.ai_usage_logs.create_index("user_id")
        await db_instance.db.ai_cache.create_index("expires_at", expireAfterSeconds=0)
        await db_instance.db.ai_cache.create_index("cache_key", unique=True)
        await db_instance.db.ai_suggestion_cache.create_index("expires_at", expireAfterSeconds=0)
        await db_instance.db.ai_suggestion_cache.create_index("cache_key", unique=True)

        # Coding Challenges Indexes
        await db_instance.db.coding_challenges.create_index("status")
        await db_instance.db.coding_challenges.create_index("category")
        await db_instance.db.coding_challenges.create_index("difficulty")
        await db_instance.db.challenge_submissions.create_index("user_id")
        await db_instance.db.challenge_submissions.create_index("challenge_id")
        await db_instance.db.challenge_submissions.create_index("submitted_at")
        await db_instance.db.user_challenge_progress.create_index([("user_id", 1), ("challenge_id", 1)], unique=True)
        await db_instance.db.user_achievements.create_index([("user_id", 1), ("achievement_type", 1)], unique=True)

        # Code Sharing Module Indexes
        await db_instance.db.shared_codes.create_index("share_id", unique=True)
        await db_instance.db.shared_codes.create_index("user_id")
        await db_instance.db.shared_codes.create_index("visibility")
        await db_instance.db.shared_codes.create_index("expires_at", expireAfterSeconds=0)
        await db_instance.db.share_access_logs.create_index([("share_id", 1), ("ip_address", 1), ("action", 1)])
        await db_instance.db.share_access_logs.create_index("timestamp")

        # Assessments & Certification Indexes
        await db_instance.db.assessments.create_index("active")
        await db_instance.db.assessments.create_index("language")
        await db_instance.db.assessments.create_index("assessment_type")
        await db_instance.db.assessment_questions.create_index("assessment_id")
        await db_instance.db.assessment_questions.create_index("difficulty")
        await db_instance.db.assessment_questions.create_index([("assessment_id", 1), ("question_number", 1)])
        await db_instance.db.assessment_questions.create_index([("assessment_id", 1), ("import_batch_id", 1)])
        await db_instance.db.active_assessment_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db_instance.db.active_assessment_sessions.create_index("user_id")
        await db_instance.db.active_assessment_sessions.create_index("assessment_id")
        await db_instance.db.assessment_attempts.create_index("user_id")
        await db_instance.db.assessment_attempts.create_index("assessment_id")
        await db_instance.db.assessment_attempts.create_index("submitted_at")
        await db_instance.db.certificates.create_index("certificate_id", unique=True)
        await db_instance.db.certificates.create_index("user_id")

        # Seed supported languages
        await seed_languages()
        
        # Seed challenges
        await seed_challenges(db_instance.db)

        # Seed assessments
        await seed_assessments(db_instance.db)
        
        # Seed admin user
        await seed_admin()
        
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise e

async def seed_languages():
    languages = [
        {
            "name": "python",
            "display_name": "Python 3.12",
            "enabled": True,
            "docker_image": "python:3.12-slim",
            "filename": "script.py",
            "compile_cmd": "",
            "run_cmd": "python script.py"
        },
        {
            "name": "javascript",
            "display_name": "JavaScript (Node 20)",
            "enabled": True,
            "docker_image": "node:20-alpine",
            "filename": "index.js",
            "compile_cmd": "",
            "run_cmd": "node index.js"
        },
        {
            "name": "c",
            "display_name": "C (GCC)",
            "enabled": True,
            "docker_image": "gcc:latest",
            "filename": "main.c",
            "compile_cmd": "gcc main.c -o main",
            "run_cmd": "./main"
        },
        {
            "name": "cpp",
            "display_name": "C++ (G++)",
            "enabled": True,
            "docker_image": "gcc:latest",
            "filename": "main.cpp",
            "compile_cmd": "g++ main.cpp -o main",
            "run_cmd": "./main"
        },
        {
            "name": "java",
            "display_name": "Java (Temurin 21)",
            "enabled": True,
            "docker_image": "eclipse-temurin:21",
            "filename": "Main.java",
            "compile_cmd": "javac Main.java",
            "run_cmd": "java Main"
        }
    ]
    
    for lang in languages:
        existing = await db_instance.db.supported_languages.find_one({"name": lang["name"]})
        if not existing:
            await db_instance.db.supported_languages.insert_one({
                **lang,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            logger.info(f"Seeded language: {lang['display_name']}")
        else:
            if existing.get("docker_image") != lang["docker_image"] or existing.get("display_name") != lang["display_name"]:
                await db_instance.db.supported_languages.update_one(
                    {"name": lang["name"]},
                    {"$set": {
                        "docker_image": lang["docker_image"],
                        "display_name": lang["display_name"],
                        "compile_cmd": lang["compile_cmd"],
                        "run_cmd": lang["run_cmd"],
                        "updated_at": datetime.utcnow()
                    }}
                )
                logger.info(f"Updated language configuration for: {lang['display_name']}")

async def seed_admin():
    # Clean up old default admin if it exists
    await db_instance.db.users.delete_one({"email": "admin@compiler.com"})
    
    admin_email = "admin@gmail.com"
    existing = await db_instance.db.users.find_one({"email": admin_email})
    if not existing:
        admin_user = {
            "name": "System Admin",
            "email": admin_email,
            "password": pwd_context.hash("admin123"),
            "role": "admin",
            "is_blocked": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db_instance.db.users.insert_one(admin_user)
        logger.info(f"Seeded admin user: {admin_email} / admin123")
