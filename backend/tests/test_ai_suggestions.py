import pytest
import pytest_asyncio
import json
import hashlib
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import create_access_token
from unittest.mock import patch, AsyncMock
from bson import ObjectId

settings.DB_NAME = "online_compiler_test"

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    await db_instance.db.users.delete_many({})
    await db_instance.db.ai_usage_logs.delete_many({})
    await db_instance.db.ai_suggestion_cache.delete_many({})
    
    # Create test user
    from app.auth import hash_password
    test_user = {
        "name": "Suggestion Tester",
        "email": "suggesttester@example.com",
        "password": hash_password("testpassword123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db_instance.db.users.insert_one(test_user)
    
    # Generate token
    token_data = {
        "sub": "suggesttester@example.com",
        "role": "user",
        "user_id": str(result.inserted_id)
    }
    access_token = create_access_token(data=token_data)
    headers = {"Authorization": f"Bearer {access_token}"}
    
    yield {"headers": headers, "user_id": str(result.inserted_id)}
    
    # Cleanup
    await db_instance.db.users.delete_many({})
    await db_instance.db.ai_usage_logs.delete_many({})
    await db_instance.db.ai_suggestion_cache.delete_many({})

@pytest.mark.asyncio
async def test_suggest_require_authentication(test_db_setup):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/ai/suggest", 
            json={"language": "python", "code": "def add(a,b):\n", "cursor_position": 14}
        )
        assert response.status_code == 401

@pytest.mark.asyncio
async def test_suggest_validates_language(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/ai/suggest", 
            json={"language": "rust", "code": "fn main() {\n", "cursor_position": 11},
            headers=headers
        )
        assert response.status_code == 400
        assert "is not supported" in response.json()["detail"]

@pytest.mark.asyncio
async def test_suggest_validates_max_length(test_db_setup):
    headers = test_db_setup["headers"]
    oversized_code = "x" * 5001
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/ai/suggest", 
            json={"language": "python", "code": oversized_code, "cursor_position": 5000},
            headers=headers
        )
        assert response.status_code == 422  # Pydantic validation error (max_length=5000)

@pytest.mark.asyncio
async def test_suggest_success(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.copilot_service.call_gemini", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.return_value = "    return a + b"
            
            payload = {"language": "python", "code": "def add(a, b):\n", "cursor_position": 15}
            response = await ac.post("/api/ai/suggest", json=payload, headers=headers)
            
            assert response.status_code == 200
            res_data = response.json()
            assert res_data["success"] is True
            assert res_data["suggestion"] == "    return a + b"
            assert res_data["source"] == "gemini"
            assert res_data["cached"] is False
            
            # Check usage log created in DB
            log = await db_instance.db.ai_usage_logs.find_one({"feature": "AI_INLINE_SUGGESTION"})
            assert log is not None
            assert log["language"] == "python"

@pytest.mark.asyncio
async def test_suggest_caching_and_optimized_keys(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.copilot_service.call_gemini", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.return_value = "    print(x)"
            
            # 1. First Call: Cache Miss
            payload1 = {"language": "python", "code": "def run(x):\n", "cursor_position": 12}
            res1 = await ac.post("/api/ai/suggest", json=payload1, headers=headers)
            assert res1.status_code == 200
            assert res1.json()["cached"] is False
            
            # 2. Second Call: Identical preceding code, different succeeding code (Cache Hit)
            # This verifies the cache key is optimized based only on code before cursor!
            payload2 = {"language": "python", "code": "def run(x):\n\n# Unrelated suffix", "cursor_position": 12}
            res2 = await ac.post("/api/ai/suggest", json=payload2, headers=headers)
            
            assert res2.status_code == 200
            assert res2.json()["cached"] is True
            assert res2.json()["suggestion"] == "    print(x)"
            
            # call_gemini should only be called once
            mock_gemini.assert_called_once()

@pytest.mark.asyncio
async def test_suggest_daily_limit_exceeded(test_db_setup):
    headers = test_db_setup["headers"]
    user_id = test_db_setup["user_id"]
    
    # Pre-seed 200 suggestion logs for today
    logs = []
    for _ in range(200):
        logs.append({
            "user_id": ObjectId(user_id),
            "feature": "AI_INLINE_SUGGESTION",
            "language": "python",
            "created_at": datetime.utcnow()
        })
    await db_instance.db.ai_usage_logs.insert_many(logs)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {"language": "python", "code": "def loop():\n", "cursor_position": 12}
        response = await ac.post("/api/ai/suggest", json=payload, headers=headers)
        
        assert response.status_code == 429
        assert response.json() == {
            "success": False,
            "message": "Daily AI suggestion limit exceeded."
        }

@pytest.mark.asyncio
async def test_suggest_gemini_failure(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.copilot_service.call_gemini", side_effect=Exception("API Down")):
            payload = {"language": "python", "code": "def fail():\n", "cursor_position": 12}
            response = await ac.post("/api/ai/suggest", json=payload, headers=headers)
            
            assert response.status_code == 503
            assert response.json() == {
                "success": False,
                "message": "AI suggestion unavailable."
            }
