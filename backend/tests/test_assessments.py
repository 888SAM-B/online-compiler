import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from bson import ObjectId
from unittest.mock import patch

from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import create_access_token, hash_password

settings.DB_NAME = "online_compiler_test"

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    # Clean database collections
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
        "name": "Test User",
        "email": "test_user@example.com",
        "password": hash_password("password123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(user_doc)
    user_token = create_access_token({"sub": "test_user@example.com", "role": "user", "user_id": str(user_id)})
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Create admin user
    admin_id = ObjectId()
    admin_doc = {
        "_id": admin_id,
        "name": "Test Admin",
        "email": "test_admin@example.com",
        "password": hash_password("password123"),
        "role": "admin",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(admin_doc)
    admin_token = create_access_token({"sub": "test_admin@example.com", "role": "admin", "user_id": str(admin_id)})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Create a dummy assessment
    assess_id = ObjectId()
    assess_doc = {
        "_id": assess_id,
        "title": "Python Quiz",
        "description": "Basic Python Quiz",
        "assessment_type": "language",
        "language": "python",
        "duration_minutes": 10,
        "questions_per_attempt": 3,
        "question_pool_size": 5,
        "passing_percentage": 60,
        "max_attempts": 3,
        "cooldown_hours": 2,
        "badge_rules": {"gold": 90, "silver": 75, "bronze": 60},
        "active": True,
        "question_pool_version": 1,
        "created_by": "admin",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.assessments.insert_one(assess_doc)

    # 4. Insert some questions
    questions = []
    for i in range(1, 6):
        q_id = ObjectId()
        questions.append({
            "_id": q_id,
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
        "admin_id": str(admin_id),
        "admin_headers": admin_headers,
        "assess_id": str(assess_id),
        "question_ids": [str(q["_id"]) for q in questions]
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
async def test_get_assessments(test_db_setup):
    headers = test_db_setup["user_headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/assessments", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Python Quiz"

@pytest.mark.asyncio
async def test_start_assessment_flow_and_session_recovery(test_db_setup):
    headers = test_db_setup["user_headers"]
    assess_id = test_db_setup["assess_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Start assessment
        res_start = await ac.post(f"/api/assessments/{assess_id}/start", headers=headers)
        assert res_start.status_code == 200
        start_data = res_start.json()
        attempt_id = start_data["attempt_id"]
        assert len(start_data["questions"]) == 3
        
        # Verify active session is created
        session = await db_instance.db.active_assessment_sessions.find_one({"attempt_id": ObjectId(attempt_id)})
        assert session is not None

        # 2. Try starting another assessment while one is active -> should fail
        res_conflict = await ac.post(f"/api/assessments/{assess_id}/start", headers=headers)
        # Wait, the backend router checks if active session is for the SAME assessment.
        # If it is the SAME assessment, it resumes the session instead of failing!
        # So starting the same assessment should resume successfully. Let's assert that!
        assert res_conflict.status_code == 200
        assert res_conflict.json()["attempt_id"] == attempt_id

        # 3. Save an answer
        q_id = start_data["questions"][0]["id"]
        res_save = await ac.post(
            f"/api/assessments/attempts/{attempt_id}/save-answer",
            json={"question_id": q_id, "selected_answer": "A"},
            headers=headers
        )
        assert res_save.status_code == 200
        assert res_save.json()["success"] is True

        # Verify saved answer in database
        attempt = await db_instance.db.assessment_attempts.find_one({"_id": ObjectId(attempt_id)})
        assert len(attempt["answers"]) == 1
        assert attempt["answers"][0]["question_id"] == q_id
        assert attempt["answers"][0]["selected_answer"] == "A"

        # 4. Resume the attempt via GET /api/assessments/attempts/{attempt_id}/resume
        res_resume = await ac.get(f"/api/assessments/attempts/{attempt_id}/resume", headers=headers)
        assert res_resume.status_code == 200
        resume_data = res_resume.json()
        assert resume_data["attempt_id"] == attempt_id
        assert len(resume_data["answers"]) == 1
        assert resume_data["answers"][0]["question_id"] == q_id
        assert resume_data["answers"][0]["selected_answer"] == "A"

@pytest.mark.asyncio
async def test_cooldown_and_max_attempts(test_db_setup):
    headers = test_db_setup["user_headers"]
    assess_id = test_db_setup["assess_id"]
    user_id = test_db_setup["user_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a submitted attempt that failed
        attempt_doc = {
            "user_id": ObjectId(user_id),
            "assessment_id": ObjectId(assess_id),
            "question_order": [],
            "shuffled_options": {},
            "answers": [],
            "score": 0,
            "percentage": 0.0,
            "badge": "failed",
            "passed": False,
            "status": "submitted",
            "started_at": datetime.utcnow() - timedelta(hours=1),
            "submitted_at": datetime.utcnow() - timedelta(hours=1),
            "duration_taken_seconds": 120
        }
        await db_instance.db.assessment_attempts.insert_one(attempt_doc)

        # Attempt to start assessment while cooldown is active -> should fail
        res_start = await ac.post(f"/api/assessments/{assess_id}/start", headers=headers)
        assert res_start.status_code == 400
        assert "cooldown active" in res_start.json()["detail"].lower()

        # Let's bypass cooldown by inserting 2 more attempts (total 3 attempts)
        for i in range(2):
            await db_instance.db.assessment_attempts.insert_one({
                "user_id": ObjectId(user_id),
                "assessment_id": ObjectId(assess_id),
                "question_order": [],
                "shuffled_options": {},
                "answers": [],
                "score": 0,
                "percentage": 0.0,
                "badge": "failed",
                "passed": False,
                "status": "submitted",
                "started_at": datetime.utcnow() - timedelta(hours=5),
                "submitted_at": datetime.utcnow() - timedelta(hours=5),
                "duration_taken_seconds": 120
            })

        # Try starting after max attempts reached -> should fail
        # First clear any active sessions to make sure we hit the max attempts block
        await db_instance.db.active_assessment_sessions.delete_many({})
        res_start_max = await ac.post(f"/api/assessments/{assess_id}/start", headers=headers)
        assert res_start_max.status_code == 400
        assert "maximum limit" in res_start_max.json()["detail"].lower()

@pytest.mark.asyncio
async def test_admin_assessments_crud(test_db_setup):
    admin_headers = test_db_setup["admin_headers"]
    user_headers = test_db_setup["user_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User trying admin routes should fail
        res_denied = await ac.get("/api/admin/assessments/analytics", headers=user_headers)
        assert res_denied.status_code == 403

        # Admin fetches analytics
        res_analytics = await ac.get("/api/admin/assessments/analytics", headers=admin_headers)
        assert res_analytics.status_code == 200
        analytics_data = res_analytics.json()
        assert "total_attempts" in analytics_data

        # Admin creates new assessment
        payload = {
            "title": "C++ Basics",
            "description": "Introduction to C++ variables",
            "assessment_type": "language",
            "language": "cpp",
            "duration_minutes": 45,
            "questions_per_attempt": 20,
            "question_pool_size": 50,
            "passing_percentage": 50,
            "max_attempts": 5,
            "cooldown_hours": 12,
            "active": True
        }
        res_create = await ac.post("/api/admin/assessments", json=payload, headers=admin_headers)
        assert res_create.status_code == 201
        created_data = res_create.json()
        assert created_data["title"] == "C++ Basics"
        new_assess_id = created_data["id"]

        # Admin adds question to C++ Basics
        q_payload = {
            "question_text": "What is cout?",
            "options": ["Output stream", "Input stream", "Class name", "Variable name"],
            "correct_answer": "Output stream",
            "difficulty": "easy",
            "explanation": "cout is std::ostream reference.",
            "points": 1
        }
        res_add_q = await ac.post(f"/api/admin/assessments/{new_assess_id}/questions", json=q_payload, headers=admin_headers)
        assert res_add_q.status_code == 201
        assert res_add_q.json()["question_text"] == "What is cout?"
