import pytest
import pytest_asyncio
import os
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from bson import ObjectId

from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import create_access_token, hash_password
from app.services.certificate_generator import generate_certificate_pdf

settings.DB_NAME = "online_compiler_test"

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    # Clean collections
    await db_instance.db.users.delete_many({})
    await db_instance.db.assessments.delete_many({})
    await db_instance.db.certificates.delete_many({})
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

    # 2. Create an assessment
    assess_id = ObjectId()
    assess_doc = {
        "_id": assess_id,
        "title": "Python Basics Certification",
        "description": "Introduction to Python concepts",
        "assessment_type": "language",
        "language": "python",
        "duration_minutes": 60,
        "questions_per_attempt": 30,
        "question_pool_size": 100,
        "passing_percentage": 50,
        "max_attempts": 3,
        "cooldown_hours": 24,
        "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
        "active": True,
        "question_pool_version": 1,
        "created_by": "admin",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.assessments.insert_one(assess_doc)

    yield {
        "user_id": str(user_id),
        "user_headers": user_headers,
        "assess_id": str(assess_id)
    }

    # Cleanup
    await db_instance.db.users.delete_many({})
    await db_instance.db.assessments.delete_many({})
    await db_instance.db.certificates.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

@pytest.mark.asyncio
async def test_pdf_generation_and_download(test_db_setup):
    user_headers = test_db_setup["user_headers"]
    user_id = test_db_setup["user_id"]
    assess_id = test_db_setup["assess_id"]

    # Generate a certificate PDF manually
    cert_id = "CERT-TEST1234"
    pdf_path = generate_certificate_pdf(
        certificate_id=cert_id,
        username="Jane Doe",
        assessment_title="Python Basics Certification",
        badge="gold",
        percentage=95.0
    )
    
    # Assert PDF file was written to disk
    assert os.path.exists(pdf_path) is True
    assert pdf_path.endswith(".pdf")

    # Insert certificate record into database
    cert_doc = {
        "certificate_id": cert_id,
        "verification_hash": "some_hash_123",
        "user_id": ObjectId(user_id),
        "assessment_id": ObjectId(assess_id),
        "attempt_id": ObjectId(),
        "badge": "gold",
        "percentage": 95.0,
        "pdf_path": pdf_path,
        "email_sent": True,
        "revoked": False,
        "revoked_reason": None,
        "issued_at": datetime.utcnow()
    }
    await db_instance.db.certificates.insert_one(cert_doc)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Download certificate endpoint (with auth headers)
        response = await ac.get(f"/api/assessments/certificates/{cert_id}/download", headers=user_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 0

        # Download certificate endpoint (without auth headers - guest access)
        response_guest = await ac.get(f"/api/assessments/certificates/{cert_id}/download")
        assert response_guest.status_code == 200
        assert response_guest.headers["content-type"] == "application/pdf"
        assert len(response_guest.content) > 0

    # Cleanup pdf file from disk
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

@pytest.mark.asyncio
async def test_public_certificate_verification(test_db_setup):
    user_id = test_db_setup["user_id"]
    assess_id = test_db_setup["assess_id"]

    cert_id = "CERT-VERIF99"
    pdf_path = "uploads/certificates/cert_verif_dummy.pdf"
    
    # Insert valid certificate
    cert_doc_valid = {
        "certificate_id": cert_id,
        "verification_hash": "valid_hash",
        "user_id": ObjectId(user_id),
        "assessment_id": ObjectId(assess_id),
        "attempt_id": ObjectId(),
        "badge": "silver",
        "percentage": 80.0,
        "pdf_path": pdf_path,
        "email_sent": True,
        "revoked": False,
        "revoked_reason": None,
        "issued_at": datetime.utcnow()
    }
    await db_instance.db.certificates.insert_one(cert_doc_valid)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Verify valid certificate (no headers needed - public endpoint)
        res_verify_valid = await ac.get(f"/api/assessments/certificates/verify/{cert_id}")
        assert res_verify_valid.status_code == 200
        data_valid = res_verify_valid.json()
        assert data_valid["valid"] is True
        assert data_valid["certificate_id"] == cert_id
        assert data_valid["user_name"] == "Jane Doe"
        assert data_valid["assessment_title"] == "Python Basics Certification"
        assert data_valid["badge"] == "silver"
        assert data_valid["percentage"] == 80.0
        assert data_valid["revoked"] is False

        # 2. Verify non-existent certificate -> should return valid=False
        res_verify_missing = await ac.get("/api/assessments/certificates/verify/CERT-NOTEXIST")
        assert res_verify_missing.status_code == 200
        data_missing = res_verify_missing.json()
        assert data_missing["valid"] is False
        assert "does not exist" in data_missing["revoked_reason"].lower()

        # 3. Revoke certificate in DB and verify
        await db_instance.db.certificates.update_one(
            {"certificate_id": cert_id},
            {"$set": {"revoked": True, "revoked_reason": "Academic dishonesty detected"}}
        )

        res_verify_revoked = await ac.get(f"/api/assessments/certificates/verify/{cert_id}")
        assert res_verify_revoked.status_code == 200
        data_revoked = res_verify_revoked.json()
        assert data_revoked["valid"] is False
        assert data_revoked["revoked"] is True
        assert data_revoked["revoked_reason"] == "Academic dishonesty detected"
