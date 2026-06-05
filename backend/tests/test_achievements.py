import pytest
import pytest_asyncio
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from bson import ObjectId

from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import create_access_token, hash_password

settings.DB_NAME = "online_compiler_test"

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    # Clean collections
    await db_instance.db.users.delete_many({})
    await db_instance.db.assessments.delete_many({})
    await db_instance.db.assessment_questions.delete_many({})
    await db_instance.db.active_assessment_sessions.delete_many({})
    await db_instance.db.assessment_attempts.delete_many({})
    await db_instance.db.certificates.delete_many({})
    await db_instance.db.user_achievements.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

    # 1. Create standard developer user
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "name": "Jane Doe",
        "email": "jane_doe@example.com",
        "password": hash_password("password123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(user_doc)
    user_token = create_access_token({"sub": "jane_doe@example.com", "role": "user", "user_id": str(user_id)})
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Create an assessment template (Python Fundamentals)
    assess_id = ObjectId()
    assess_doc = {
        "_id": assess_id,
        "title": "Python Fundamentals",
        "description": "Python basic syntax",
        "assessment_type": "language",
        "language": "python",
        "duration_minutes": 10,
        "questions_per_attempt": 2,
        "question_pool_size": 2,
        "passing_percentage": 50,
        "max_attempts": 3,
        "cooldown_hours": 1,
        "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
        "active": True,
        "question_pool_version": 1,
        "created_by": "admin",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.assessments.insert_one(assess_doc)

    # 3. Create questions
    questions = []
    for i in range(1, 3):
        questions.append({
            "_id": ObjectId(),
            "assessment_id": assess_id,
            "question_text": f"Question {i}",
            "question_type": "mcq",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "A",
            "difficulty": "easy",
            "explanation": "Exp",
            "points": 1,
            "active": True,
            "created_at": datetime.utcnow()
        })
    await db_instance.db.assessment_questions.insert_many(questions)

    yield {
        "user_id": str(user_id),
        "user_headers": user_headers,
        "assess_id": str(assess_id),
        "questions": questions
    }

    # Cleanup
    await db_instance.db.users.delete_many({})
    await db_instance.db.assessments.delete_many({})
    await db_instance.db.assessment_questions.delete_many({})
    await db_instance.db.active_assessment_sessions.delete_many({})
    await db_instance.db.assessment_attempts.delete_many({})
    await db_instance.db.certificates.delete_many({})
    await db_instance.db.user_achievements.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

@pytest.mark.asyncio
async def test_achievement_unlocking_on_submit(test_db_setup):
    headers = test_db_setup["user_headers"]
    assess_id = test_db_setup["assess_id"]
    user_id = test_db_setup["user_id"]
    questions = test_db_setup["questions"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Start assessment
        res_start = await ac.post(f"/api/assessments/{assess_id}/start", headers=headers)
        assert res_start.status_code == 200
        attempt_id = res_start.json()["attempt_id"]

        # Submit answers - 100% score (perfect score)
        answers_payload = [
            {"question_id": str(questions[0]["_id"]), "selected_answer": "A"},
            {"question_id": str(questions[1]["_id"]), "selected_answer": "A"}
        ]
        
        res_submit = await ac.post(
            f"/api/assessments/attempts/{attempt_id}/submit",
            json={"answers": answers_payload},
            headers=headers
        )
        assert res_submit.status_code == 200
        submit_data = res_submit.json()
        assert submit_data["passed"] is True
        assert submit_data["score"] == 2
        assert submit_data["percentage"] == 100.0
        assert submit_data["badge"] == "gold"
        
        # Verify achievements unlocked: FIRST_ASSESSMENT, FIRST_CERTIFICATE, PYTHON_CERTIFIED, PERFECT_SCORE
        unlocked = submit_data["unlocked_achievements"]
        assert "FIRST_ASSESSMENT" in unlocked
        assert "FIRST_CERTIFICATE" in unlocked
        assert "PYTHON_CERTIFIED" in unlocked
        assert "PERFECT_SCORE" in unlocked

        # Verify database documents in user_achievements
        ach_count = await db_instance.db.user_achievements.count_documents({"user_id": ObjectId(user_id)})
        assert ach_count == 4

        # Verify duplicate constraints - if we insert a duplicate achievement manually it should be ignored or fail silently without crashing the submission flow
        await db_instance.db.user_achievements.update_one(
            {"user_id": ObjectId(user_id), "achievement_type": "FIRST_CERTIFICATE"},
            {"$set": {"unlocked_at": datetime.utcnow()}}
        )
