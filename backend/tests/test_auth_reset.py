import pytest
import pytest_asyncio
import hashlib
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import verify_password
from unittest.mock import patch

# Configure for test run
settings.DB_NAME = "online_compiler_test"
settings.SUPPRESS_SEND = True

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    # Make sure DB is initialized
    await init_db()
    
    # Clear collections
    await db_instance.db.users.delete_many({})
    await db_instance.db.password_reset_otps.delete_many({})
    await db_instance.db.activity_logs.delete_many({})
    
    # Create test user
    from app.auth import hash_password
    test_user = {
        "name": "Test Developer",
        "email": "testdev@example.com",
        "password": hash_password("oldsecurepwd123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(test_user)
    
    yield
    
    # Cleanup after test finishes
    await db_instance.db.users.delete_many({})
    await db_instance.db.password_reset_otps.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

@pytest.mark.asyncio
async def test_forgot_password_sends_email_if_user_exists():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Mock the send_otp_email service function
        with patch("app.routes.auth_routes.email_service.send_otp_email", return_value=True) as mock_send:
            response = await ac.post("/api/auth/forgot-password", json={"email": "testdev@example.com"})
            
            assert response.status_code == 200
            assert response.json() == {"message": "If the account exists, an OTP has been sent."}
            mock_send.assert_called_once()
            
            # Check OTP record created in MongoDB
            otp_record = await db_instance.db.password_reset_otps.find_one({"email": "testdev@example.com"})
            assert otp_record is not None
            assert otp_record["used"] is False
            assert "otp_hash" in otp_record
            assert otp_record["otp_hash"] != ""
            # Ensure it is stored as a hash (should be 64 char hex string for sha256)
            assert len(otp_record["otp_hash"]) == 64

@pytest.mark.asyncio
async def test_forgot_password_email_enumeration_protection():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.auth_routes.email_service.send_otp_email", return_value=True) as mock_send:
            # Post for email that does not exist
            response = await ac.post("/api/auth/forgot-password", json={"email": "nonexistent@example.com"})
            
            # Response must still be 200 and have the same generic message
            assert response.status_code == 200
            assert response.json() == {"message": "If the account exists, an OTP has been sent."}
            
            # Mail sending should NOT be called
            mock_send.assert_not_called()
            
            # No OTP record should be created
            otp_record = await db_instance.db.password_reset_otps.find_one({"email": "nonexistent@example.com"})
            assert otp_record is None

@pytest.mark.asyncio
async def test_forgot_password_rate_limiting():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.routes.auth_routes.email_service.send_otp_email", return_value=True):
            # Email limits: Max 3 per email per hour
            for i in range(3):
                response = await ac.post("/api/auth/forgot-password", json={"email": "testdev@example.com"})
                assert response.status_code == 200
            
            # 4th request should fail with 429
            response = await ac.post("/api/auth/forgot-password", json={"email": "testdev@example.com"})
            assert response.status_code == 429
            assert "Too many password reset requests" in response.json()["detail"]

@pytest.mark.asyncio
async def test_verify_otp_valid_and_invalid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create OTP record directly in database
        otp_val = "987654"
        otp_hash = hashlib.sha256(otp_val.encode()).hexdigest()
        await db_instance.db.password_reset_otps.insert_one({
            "email": "testdev@example.com",
            "otp_hash": otp_hash,
            "used": False,
            "attempts": 0,
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "created_at": datetime.utcnow(),
            "ip_address": "127.0.0.1"
        })
        
        # Test verification with invalid OTP
        response = await ac.post("/api/auth/verify-otp", json={"email": "testdev@example.com", "otp": "000000"})
        assert response.status_code == 400
        
        # Test verification with correct OTP
        response = await ac.post("/api/auth/verify-otp", json={"email": "testdev@example.com", "otp": otp_val})
        assert response.status_code == 200
        assert response.json() == {"valid": True}

@pytest.mark.asyncio
async def test_verify_otp_max_attempts():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        otp_val = "123456"
        otp_hash = hashlib.sha256(otp_val.encode()).hexdigest()
        await db_instance.db.password_reset_otps.insert_one({
            "email": "testdev@example.com",
            "otp_hash": otp_hash,
            "used": False,
            "attempts": 4,  # already has 4 failed attempts
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "created_at": datetime.utcnow(),
            "ip_address": "127.0.0.1"
        })
        
        # 5th attempt (which fails)
        response = await ac.post("/api/auth/verify-otp", json={"email": "testdev@example.com", "otp": "000000"})
        assert response.status_code == 400
        
        # 6th attempt should be rejected immediately due to attempt cap
        response = await ac.post("/api/auth/verify-otp", json={"email": "testdev@example.com", "otp": otp_val})
        assert response.status_code == 400
        assert "Too many failed attempts" in response.json()["detail"]

@pytest.mark.asyncio
async def test_password_reset_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        otp_val = "654321"
        otp_hash = hashlib.sha256(otp_val.encode()).hexdigest()
        await db_instance.db.password_reset_otps.insert_one({
            "email": "testdev@example.com",
            "otp_hash": otp_hash,
            "used": False,
            "attempts": 0,
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "created_at": datetime.utcnow(),
            "ip_address": "127.0.0.1"
        })
        
        with patch("app.routes.auth_routes.email_service.send_reset_success_email", return_value=True) as mock_send_success:
            response = await ac.post("/api/auth/reset-password", json={
                "email": "testdev@example.com",
                "otp": otp_val,
                "new_password": "brandnewpwd123"
            })
            
            assert response.status_code == 200
            assert response.json() == {"message": "Password reset successful"}
            mock_send_success.assert_called_once()
            
            # OTP record should be marked as used
            otp_record = await db_instance.db.password_reset_otps.find_one({"email": "testdev@example.com"})
            assert otp_record["used"] is True
            
            # User password in DB should be updated
            user = await db_instance.db.users.find_one({"email": "testdev@example.com"})
            assert verify_password("brandnewpwd123", user["password"])
            
            # Activity logs should have PASSWORD_RESET_SUCCESS
            log = await db_instance.db.activity_logs.find_one({"action": "PASSWORD_RESET_SUCCESS"})
            assert log is not None
            assert log["email"] == "testdev@example.com"
