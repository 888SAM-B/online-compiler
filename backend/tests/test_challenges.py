import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from bson import ObjectId

from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import create_access_token, hash_password

settings.DB_NAME = "online_compiler_test"

# Helper mock execution function
async def mock_execute_code_with_input(language_info, code, stdin):
    if "fail" in code:
        return {"success": True, "output": "incorrect_output\n", "error": "", "execution_time": 0.02}
    if "error" in code:
        return {"success": False, "output": "", "error": "Compile/Runtime error details", "execution_time": 0.01}
        
    # Match standard inputs for sum challenges
    clean_stdin = stdin.strip()
    if clean_stdin == "5 7":
        return {"success": True, "output": "12\n", "error": "", "execution_time": 0.01}
    if clean_stdin == "-1 1":
        return {"success": True, "output": "0\n", "error": "", "execution_time": 0.01}
    if clean_stdin == "100 200":
        return {"success": True, "output": "300\n", "error": "", "execution_time": 0.01}
    if clean_stdin == "-50 -50":
        return {"success": True, "output": "-100\n", "error": "", "execution_time": 0.01}
    if clean_stdin == "1000000000 2000000000":
        return {"success": True, "output": "3000000000\n", "error": "", "execution_time": 0.01}
        
    return {"success": True, "output": "12\n", "error": "", "execution_time": 0.01}

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    # Clean challenges and progress collections
    await db_instance.db.users.delete_many({})
    await db_instance.db.coding_challenges.delete_many({})
    await db_instance.db.challenge_submissions.delete_many({})
    await db_instance.db.user_challenge_progress.delete_many({})
    await db_instance.db.user_achievements.delete_many({})

    # 1. Create standard developer user
    user_id = ObjectId()
    developer = {
        "_id": user_id,
        "name": "Developer Test",
        "email": "developer@example.com",
        "password": hash_password("developer123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(developer)
    user_token = create_access_token({"sub": "developer@example.com", "role": "user", "user_id": str(user_id)})
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Create admin user
    admin_id = ObjectId()
    admin = {
        "_id": admin_id,
        "name": "Admin Test",
        "email": "admin@example.com",
        "password": hash_password("admin123"),
        "role": "admin",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(admin)
    admin_token = create_access_token({"sub": "admin@example.com", "role": "admin", "user_id": str(admin_id)})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Insert one test challenge to work with
    challenge_id = ObjectId()
    challenge = {
        "_id": challenge_id,
        "title": "Mock Sum Challenge",
        "version": 1,
        "status": "active",
        "difficulty": "Easy",
        "category": "Math",
        "tags": ["math", "basics"],
        "problem_statement": "Write a program to sum two numbers.",
        "input_format": "Two space-separated ints.",
        "output_format": "The sum.",
        "constraints": "-1000 <= A, B <= 1000",
        "sample_input": "5 7",
        "sample_output": "12",
        "estimated_time_minutes": 5,
        "supported_languages": ["python", "javascript"],
        "starter_code": {"python": "pass", "javascript": "console.log()"},
        "sample_test_cases": [
            {"input": "5 7", "expected_output": "12"},
            {"input": "-1 1", "expected_output": "0"}
        ],
        "hidden_test_cases": [
            {"input": "100 200", "expected_output": "300"},
            {"input": "-50 -50", "expected_output": "-100"}
        ],
        "points": 50,
        "success_rate": 0.0,
        "total_submissions": 0,
        "total_solves": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.coding_challenges.insert_one(challenge)

    yield {
        "user_id": str(user_id),
        "user_headers": user_headers,
        "admin_id": str(admin_id),
        "admin_headers": admin_headers,
        "challenge_id": str(challenge_id)
    }

    # Cleanup
    await db_instance.db.users.delete_many({})
    await db_instance.db.coding_challenges.delete_many({})
    await db_instance.db.challenge_submissions.delete_many({})
    await db_instance.db.user_challenge_progress.delete_many({})
    await db_instance.db.user_achievements.delete_many({})

# --- Challenge Retrieval Tests ---

@pytest.mark.asyncio
async def test_get_challenges_list(test_db_setup):
    headers = test_db_setup["user_headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/challenges", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Mock Sum Challenge"
        # Hidden test cases must be OMITTED for normal user list
        assert "hidden_test_cases" not in data[0]

@pytest.mark.asyncio
async def test_get_challenge_by_id(test_db_setup):
    headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/api/challenges/{cid}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Mock Sum Challenge"
        # Hidden test cases must be OMITTED for normal user detail
        assert "hidden_test_cases" not in data

# --- Run Solution Tests ---

@pytest.mark.asyncio
async def test_run_challenge_code(test_db_setup):
    headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.challenge_routes.execute_code_with_input", new=mock_execute_code_with_input):
            payload = {"language": "python", "source_code": "print('12')"}
            response = await ac.post(f"/api/challenges/{cid}/run", json=payload, headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["results"]) == 2
            assert data["results"][0]["passed"] is True
            assert data["results"][0]["expected_output"] == "12"

@pytest.mark.asyncio
async def test_run_challenge_code_fail(test_db_setup):
    headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.challenge_routes.execute_code_with_input", new=mock_execute_code_with_input):
            payload = {"language": "python", "source_code": "fail code"}
            response = await ac.post(f"/api/challenges/{cid}/run", json=payload, headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert data["results"][0]["passed"] is False

# --- Submit Solution Tests ---

@pytest.mark.asyncio
async def test_submit_challenge_solution_pass(test_db_setup):
    headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]
    user_id = test_db_setup["user_id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.challenge_routes.execute_code_with_input", new=mock_execute_code_with_input):
            payload = {"language": "python", "source_code": "def solve(): pass"}
            response = await ac.post(f"/api/challenges/{cid}/submit", json=payload, headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["passed"] is True
            assert data["passed_test_cases"] == 2
            assert data["total_test_cases"] == 2
            assert data["score"] == 50.0

            # Verify progress database updates
            progress = await db_instance.db.user_challenge_progress.find_one({"user_id": user_id, "challenge_id": cid})
            assert progress is not None
            assert progress["solved"] is True
            assert progress["best_score"] == 50.0
            assert progress["attempts"] == 1

            # Verify challenge stats update
            challenge = await db_instance.db.coding_challenges.find_one({"_id": ObjectId(cid)})
            assert challenge["total_submissions"] == 1
            assert challenge["total_solves"] == 1
            assert challenge["success_rate"] == 100.0

            # Verify FIRST_SUBMISSION and FIRST_SOLVE achievements unlocked
            ach_count = await db_instance.db.user_achievements.count_documents({"user_id": user_id})
            assert ach_count >= 2

@pytest.mark.asyncio
async def test_submit_challenge_solution_rate_limit(test_db_setup):
    headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.challenge_routes.execute_code_with_input", new=mock_execute_code_with_input):
            payload = {"language": "python", "source_code": "def solve(): pass"}
            # Submit 10 times to hit limit
            for _ in range(10):
                res = await ac.post(f"/api/challenges/{cid}/submit", json=payload, headers=headers)
                assert res.status_code == 200
            
            # 11th should throw 429
            response = await ac.post(f"/api/challenges/{cid}/submit", json=payload, headers=headers)
            assert response.status_code == 429
            assert "Rate limit exceeded" in response.json()["detail"]

# --- Leaderboard & Progress Tests ---

@pytest.mark.asyncio
async def test_leaderboard_and_progress(test_db_setup):
    headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]
    user_id = test_db_setup["user_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.challenge_routes.execute_code_with_input", new=mock_execute_code_with_input):
            # 1. Submit passing code
            await ac.post(f"/api/challenges/{cid}/submit", json={"language": "python", "source_code": "pass"}, headers=headers)
            
            # 2. Query Progress
            prog_res = await ac.get("/api/challenges/progress", headers=headers)
            assert prog_res.status_code == 200
            prog_data = prog_res.json()
            assert prog_data["total_solved"] == 1
            assert prog_data["total_score"] == 50.0
            assert prog_data["best_language"] == "Python"
            assert prog_data["global_rank"] == 1

            # 3. Query Leaderboard
            leader_res = await ac.get("/api/challenges/leaderboard", headers=headers)
            assert leader_res.status_code == 200
            leader_data = leader_res.json()
            assert len(leader_data["leaderboard"]) == 1
            assert leader_data["leaderboard"][0]["user_id"] == user_id
            assert leader_data["leaderboard"][0]["total_score"] == 50.0

# --- Admin API Tests ---

@pytest.mark.asyncio
async def test_admin_crud_challenges(test_db_setup):
    admin_headers = test_db_setup["admin_headers"]
    user_headers = test_db_setup["user_headers"]
    cid = test_db_setup["challenge_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Get admin challenge detail (should include hidden cases)
        res_get = await ac.get(f"/api/admin/challenges/{cid}", headers=admin_headers)
        assert res_get.status_code == 200
        assert "hidden_test_cases" in res_get.json()

        # 2. Reject normal users trying to get admin challenge details
        res_get_user = await ac.get(f"/api/admin/challenges/{cid}", headers=user_headers)
        assert res_get_user.status_code == 403

        # 3. Create challenge as admin
        new_challenge = {
            "title": "Admin New Challenge",
            "difficulty": "Medium",
            "category": "Arrays",
            "tags": ["arrays"],
            "problem_statement": "statement",
            "input_format": "input",
            "output_format": "output",
            "constraints": "constraints",
            "sample_input": "1",
            "sample_output": "1",
            "estimated_time_minutes": 15,
            "supported_languages": ["python"],
            "starter_code": {"python": "pass"},
            "sample_test_cases": [{"input": "1", "expected_output": "1"}],
            "hidden_test_cases": [{"input": "2", "expected_output": "2"}],
            "points": 100,
            "status": "draft"
        }
        res_post = await ac.post("/api/admin/challenges", json=new_challenge, headers=admin_headers)
        assert res_post.status_code == 200
        new_id = res_post.json()["id"]

        # 4. Export challenges
        res_export = await ac.get("/api/admin/challenges/export/all", headers=admin_headers)
        assert res_export.status_code == 200
        assert len(res_export.json()) == 2

        # 5. Delete challenge
        res_delete = await ac.delete(f"/api/admin/challenges/{new_id}", headers=admin_headers)
        assert res_delete.status_code == 204
