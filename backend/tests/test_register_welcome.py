import pytest
import pytest_asyncio
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from unittest.mock import patch

settings.DB_NAME = "online_compiler_test"
settings.SUPPRESS_SEND = True

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    await db_instance.db.users.delete_many({})
    await db_instance.db.activity_logs.delete_many({})
    yield
    await db_instance.db.users.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

@pytest.mark.asyncio
async def test_register_welcome_email_triggered():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.auth_routes.email_service.send_welcome_email", return_value=True) as mock_send_welcome:
            payload = {
                "name": "New Developer",
                "email": "newdev@example.com",
                "password": "supersecurepassword123"
            }
            response = await ac.post("/api/auth/register", json=payload)
            
            assert response.status_code == 201
            assert response.json()["email"] == "newdev@example.com"
            assert response.json()["name"] == "New Developer"
            
            # Verify background task triggered the welcome email
            mock_send_welcome.assert_called_once_with("newdev@example.com", "New Developer")
