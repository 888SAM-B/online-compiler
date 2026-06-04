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
    await db_instance.db.ai_cache.delete_many({})
    await db_instance.db.activity_logs.delete_many({})
    
    # Create test user
    from app.auth import hash_password
    test_user = {
        "name": "AI Tester",
        "email": "aitester@example.com",
        "password": hash_password("testpassword123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db_instance.db.users.insert_one(test_user)
    
    # Generate token
    token_data = {
        "sub": "aitester@example.com",
        "role": "user",
        "user_id": str(result.inserted_id)
    }
    access_token = create_access_token(data=token_data)
    
    # Provide auth header dictionary
    headers = {"Authorization": f"Bearer {access_token}"}
    
    yield {"headers": headers, "user_id": str(result.inserted_id)}
    
    # Cleanup after tests
    await db_instance.db.users.delete_many({})
    await db_instance.db.ai_usage_logs.delete_many({})
    await db_instance.db.ai_cache.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

@pytest.mark.asyncio
async def test_ai_endpoints_require_authentication(test_db_setup):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Request without auth headers
        response = await ac.post("/api/ai/explain", json={"language": "python", "code": "print(1)"})
        assert response.status_code == 401

@pytest.mark.asyncio
async def test_ai_explain_validates_language(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Reject unsupported language (e.g. PHP)
        response = await ac.post(
            "/api/ai/explain", 
            json={"language": "php", "code": "echo 'hello';"},
            headers=headers
        )
        assert response.status_code == 400
        assert "not supported" in response.json()["detail"]

@pytest.mark.asyncio
async def test_ai_explain_success(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.ai_service.call_gemini", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.return_value = "This code prints the number 1 to the screen."
            
            payload = {"language": "python", "code": "print(1)"}
            response = await ac.post("/api/ai/explain", json=payload, headers=headers)
            
            assert response.status_code == 200
            assert response.json()["success"] is True
            assert response.json()["explanation"] == "This code prints the number 1 to the screen."
            mock_gemini.assert_called_once()
            
            # Check usage log created in database
            log = await db_instance.db.ai_usage_logs.find_one({"email": "aitester@example.com"})
            assert log is not None
            assert log["feature"] == "EXPLAIN"

@pytest.mark.asyncio
async def test_ai_explain_caching(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.ai_service.call_gemini", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.return_value = "Cached Explanation Text"
            
            payload = {"language": "python", "code": "print('caching')"}
            
            # 1. First call (Cache Miss)
            res1 = await ac.post("/api/ai/explain", json=payload, headers=headers)
            assert res1.status_code == 200
            
            # 2. Second call (Cache Hit)
            res2 = await ac.post("/api/ai/explain", json=payload, headers=headers)
            assert res2.status_code == 200
            assert res2.json()["explanation"] == "Cached Explanation Text"
            
            # Gemini should only be called ONCE
            mock_gemini.assert_called_once()

@pytest.mark.asyncio
async def test_ai_debug_structured_json(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.ai_service.call_gemini", new_callable=AsyncMock) as mock_gemini:
            issues_mock = {
                "issues": [
                    {
                        "type": "Syntax Error",
                        "description": "Missing colon at the end of loop definition",
                        "fix": "for i in range(5):"
                    }
                ]
            }
            mock_gemini.return_value = json.dumps(issues_mock)
            
            payload = {"language": "python", "code": "for i in range(5)\n  print(i)"}
            response = await ac.post("/api/ai/debug", json=payload, headers=headers)
            
            assert response.status_code == 200
            assert response.json()["success"] is True
            assert len(response.json()["issues"]) == 1
            assert response.json()["issues"][0]["type"] == "Syntax Error"

@pytest.mark.asyncio
async def test_ai_generate_code(test_db_setup):
    headers = test_db_setup["headers"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.services.ai_service.call_gemini", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.return_value = "def add(a, b):\n    return a + b"
            
            payload = {"language": "python", "prompt": "Create an addition function"}
            response = await ac.post("/api/ai/generate", json=payload, headers=headers)
            
            assert response.status_code == 200
            assert response.json()["success"] is True
            assert "def add(a, b)" in response.json()["generated_code"]



@pytest.mark.asyncio
async def test_ai_daily_limit_exceeded(test_db_setup):
    headers = test_db_setup["headers"]
    user_id = test_db_setup["user_id"]
    
    # Pre-seed 50 logs for today
    logs = []
    for _ in range(50):
        logs.append({
            "user_id": ObjectId(user_id),
            "email": "aitester@example.com",
            "feature": "EXPLAIN",
            "language": "python",
            "prompt_length": 50,
            "response_length": 100,
            "created_at": datetime.utcnow(),
            "ip_address": "127.0.0.1"
        })
    await db_instance.db.ai_usage_logs.insert_many(logs)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 51st request should be rejected with 429
        response = await ac.post(
            "/api/ai/explain", 
            json={"language": "python", "code": "print('over limit')"},
            headers=headers
        )
        assert response.status_code == 429
        assert "Daily AI limit exceeded" in response.json()["detail"]
