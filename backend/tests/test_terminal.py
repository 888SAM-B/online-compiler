import pytest
import pytest_asyncio
import json
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.services.terminal_manager import terminal_manager

settings.DB_NAME = "online_compiler_test"

async def get_test_user_headers(ac: AsyncClient):
    # Register test user
    reg_payload = {
        "name": "Terminal Test",
        "email": "term_test@example.com",
        "password": "testpassword123"
    }
    await ac.post("/api/auth/register", json=reg_payload)
    # Login to get token
    login_payload = {
        "email": "term_test@example.com",
        "password": "testpassword123"
    }
    res = await ac.post("/api/auth/login", json=login_payload)
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    # Ensure supported languages have Python
    await db_instance.db.supported_languages.delete_many({})
    await db_instance.db.supported_languages.insert_one({
        "name": "python",
        "display_name": "Python 3.12",
        "enabled": True,
        "docker_image": "python:3.12-slim",
        "filename": "script.py",
        "compile_cmd": "",
        "run_cmd": "python script.py"
    })
    await db_instance.db.users.delete_many({})
    await db_instance.db.terminal_sessions.delete_many({})
    yield
    await db_instance.db.users.delete_many({})
    await db_instance.db.terminal_sessions.delete_many({})
    await db_instance.db.supported_languages.delete_many({})

@pytest.mark.asyncio
async def test_terminal_session_lifecycle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_test_user_headers(ac)

        # 1. Start session
        start_payload = {
            "language": "python",
            "code": "print('Hello World')"
        }
        res_start = await ac.post("/api/terminal/start", json=start_payload, headers=headers)
        assert res_start.status_code == 200
        session_id = res_start.json()["session_id"]
        assert session_id is not None

        # 2. Verify active session
        res_active = await ac.get("/api/terminal/active", headers=headers)
        assert res_active.status_code == 200
        assert res_active.json()["session_id"] == session_id

        # 3. Check history
        res_history = await ac.get("/api/terminal/history", headers=headers)
        assert res_history.status_code == 200
        assert len(res_history.json()) >= 1
        assert res_history.json()[0]["session_id"] == session_id

        # 4. Stop session
        res_stop = await ac.post(f"/api/terminal/{session_id}/stop", headers=headers)
        assert res_stop.status_code == 200
        assert res_stop.json()["message"] == "Termination signal sent."
