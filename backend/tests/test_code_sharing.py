import pytest
import pytest_asyncio
import gzip
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from bson import ObjectId

from app.main import app
from app.config import settings
from app.database import init_db, db_instance
from app.auth import create_access_token, hash_password

settings.DB_NAME = "online_compiler_test"

@pytest_asyncio.fixture(autouse=True)
async def test_db_setup():
    await init_db()
    # Clean shared codes and related database collections
    await db_instance.db.users.delete_many({})
    await db_instance.db.programs.delete_many({})
    await db_instance.db.shared_codes.delete_many({})
    await db_instance.db.share_access_logs.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

    # 1. Create standard developer user A (Owner)
    user_a_id = ObjectId()
    user_a = {
        "_id": user_a_id,
        "name": "Developer A",
        "email": "user_a@example.com",
        "password": hash_password("password123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(user_a)
    user_a_token = create_access_token({"sub": "user_a@example.com", "role": "user", "user_id": str(user_a_id)})
    user_a_headers = {"Authorization": f"Bearer {user_a_token}"}

    # 2. Create standard developer user B (Forker)
    user_b_id = ObjectId()
    user_b = {
        "_id": user_b_id,
        "name": "Developer B",
        "email": "user_b@example.com",
        "password": hash_password("password123"),
        "role": "user",
        "is_blocked": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db_instance.db.users.insert_one(user_b)
    user_b_token = create_access_token({"sub": "user_b@example.com", "role": "user", "user_id": str(user_b_id)})
    user_b_headers = {"Authorization": f"Bearer {user_b_token}"}

    yield {
        "user_a_id": str(user_a_id),
        "user_a_headers": user_a_headers,
        "user_b_id": str(user_b_id),
        "user_b_headers": user_b_headers
    }

    # Cleanup
    await db_instance.db.users.delete_many({})
    await db_instance.db.programs.delete_many({})
    await db_instance.db.shared_codes.delete_many({})
    await db_instance.db.share_access_logs.delete_many({})
    await db_instance.db.activity_logs.delete_many({})

@pytest.mark.asyncio
async def test_create_code_share_success(test_db_setup):
    headers = test_db_setup["user_a_headers"]
    user_id = test_db_setup["user_a_id"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "title": "Clean Python Algorithm",
            "description": "Simple binary search algorithm in Python.",
            "language": "python",
            "source_code": "def binary_search(arr, target): return -1",
            "visibility": "public",
            "expires_in_hours": 24
        }
        
        response = await ac.post("/api/share", json=payload, headers=headers)
        assert response.status_code == 201
        
        data = response.json()
        assert data["title"] == "Clean Python Algorithm"
        assert len(data["share_id"]) == 16  # secrets.token_urlsafe(12) results in 16 characters
        assert data["user_id"] == user_id
        assert data["source_code"] == "def binary_search(arr, target): return -1"
        assert data["visibility"] == "public"
        assert data["expires_at"] is not None

        # Verify it exists in database and is gzip compressed
        db_record = await db_instance.db.shared_codes.find_one({"share_id": data["share_id"]})
        assert db_record is not None
        assert isinstance(db_record["source_code"], bytes)
        assert gzip.decompress(db_record["source_code"]).decode("utf-8") == "def binary_search(arr, target): return -1"

@pytest.mark.asyncio
async def test_create_code_share_rate_limit(test_db_setup):
    headers = test_db_setup["user_a_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "title": "Bulk Snippet",
            "language": "python",
            "source_code": "print('hello')",
            "visibility": "unlisted"
        }
        
        # Create 20 shares to reach limit
        for i in range(20):
            res = await ac.post("/api/share", json=payload, headers=headers)
            assert res.status_code == 201
            
        # 21st share should throw 429 Too Many Requests
        response = await ac.post("/api/share", json=payload, headers=headers)
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["detail"]

@pytest.mark.asyncio
async def test_get_share_public_vs_private(test_db_setup):
    headers_a = test_db_setup["user_a_headers"]
    headers_b = test_db_setup["user_b_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create unlisted share
        res_unlisted = await ac.post("/api/share", json={
            "title": "Unlisted Snippet",
            "language": "python",
            "source_code": "pass",
            "visibility": "unlisted"
        }, headers=headers_a)
        share_id_unlisted = res_unlisted.json()["share_id"]

        # Create private share
        res_private = await ac.post("/api/share", json={
            "title": "Private Snippet",
            "language": "python",
            "source_code": "pass",
            "visibility": "private"
        }, headers=headers_a)
        share_id_private = res_private.json()["share_id"]

        # 1. Unlisted snippet should be accessible by anyone (publicly, no headers)
        res_get_unlisted = await ac.get(f"/api/share/{share_id_unlisted}")
        assert res_get_unlisted.status_code == 200
        assert res_get_unlisted.json()["title"] == "Unlisted Snippet"

        # 2. Private snippet should be accessible by owner
        res_get_private_owner = await ac.get(f"/api/share/{share_id_private}", headers=headers_a)
        assert res_get_private_owner.status_code == 200
        assert res_get_private_owner.json()["title"] == "Private Snippet"

        # 3. Private snippet should block non-owners
        res_get_private_guest = await ac.get(f"/api/share/{share_id_private}", headers=headers_b)
        assert res_get_private_guest.status_code == 403

        # 4. Private snippet should block anonymous viewers
        res_get_private_anon = await ac.get(f"/api/share/{share_id_private}")
        assert res_get_private_anon.status_code == 403

@pytest.mark.asyncio
async def test_view_abuse_prevention(test_db_setup):
    headers_a = test_db_setup["user_a_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create public share
        res = await ac.post("/api/share", json={
            "title": "Tracking View Snippet",
            "language": "python",
            "source_code": "pass",
            "visibility": "public"
        }, headers=headers_a)
        share_id = res.json()["share_id"]

        # Initial view count is 0
        assert res.json()["views"] == 0

        # First view from localhost IP => increments to 1
        res1 = await ac.get(f"/api/share/{share_id}")
        assert res1.status_code == 200
        assert res1.json()["views"] == 1

        # Second view from same IP within 24h => view count stays 1
        res2 = await ac.get(f"/api/share/{share_id}")
        assert res2.status_code == 200
        assert res2.json()["views"] == 1

        # Check logs count: there should be 2 access log items (one primary, one secondary)
        logs_count = await db_instance.db.share_access_logs.count_documents({"share_id": share_id, "action": "VIEW"})
        assert logs_count == 2

@pytest.mark.asyncio
async def test_copy_link_tracking(test_db_setup):
    headers_a = test_db_setup["user_a_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/share", json={
            "title": "Copy Snippet",
            "language": "python",
            "source_code": "pass",
            "visibility": "public"
        }, headers=headers_a)
        share_id = res.json()["share_id"]

        # Call Copy tracking endpoint
        res_copy = await ac.post(f"/api/share/{share_id}/copy")
        assert res_copy.status_code == 200
        assert res_copy.json()["success"] is True

        # Verify database incremented the copy counter
        share = await db_instance.db.shared_codes.find_one({"share_id": share_id})
        assert share["link_copies"] == 1

        # Verify access log created
        log = await db_instance.db.share_access_logs.find_one({"share_id": share_id, "action": "COPY"})
        assert log is not None

@pytest.mark.asyncio
async def test_fork_share_endpoint(test_db_setup):
    headers_a = test_db_setup["user_a_headers"]
    headers_b = test_db_setup["user_b_headers"]
    user_b_id = test_db_setup["user_b_id"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/share", json={
            "title": "Snippets to Fork",
            "language": "python",
            "source_code": "print('fork me')",
            "visibility": "public"
        }, headers=headers_a)
        share_id = res.json()["share_id"]

        # 1. Own Fork Prevention check
        res_fork_self = await ac.post(f"/api/share/{share_id}/fork", headers=headers_a)
        assert res_fork_self.status_code == 400
        assert "cannot fork your own" in res_fork_self.json()["detail"]

        # 2. Fork by User B
        res_fork_other = await ac.post(f"/api/share/{share_id}/fork", headers=headers_b)
        assert res_fork_other.status_code == 200
        
        program_data = res_fork_other.json()
        assert program_data["title"] == "Fork of Snippets to Fork"
        assert program_data["language"] == "python"
        assert program_data["source_code"] == "print('fork me')"
        assert program_data["user_id"] == user_b_id

        # Verify forks incremented in original share doc
        orig_share = await db_instance.db.shared_codes.find_one({"share_id": share_id})
        assert orig_share["forks"] == 1

        # Verify fork log created
        log = await db_instance.db.share_access_logs.find_one({"share_id": share_id, "action": "FORK"})
        assert log is not None

@pytest.mark.asyncio
async def test_get_my_share_analytics(test_db_setup):
    headers_a = test_db_setup["user_a_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Before creating, check empty analytics
        res_empty = await ac.get("/api/share/my/analytics", headers=headers_a)
        assert res_empty.status_code == 200
        assert res_empty.json()["total_shares"] == 0

        # Create two shares
        res1 = await ac.post("/api/share", json={
            "title": "Snipp A",
            "language": "python",
            "source_code": "pass",
            "visibility": "public"
        }, headers=headers_a)
        share_a_id = res1.json()["share_id"]

        res2 = await ac.post("/api/share", json={
            "title": "Snipp B",
            "language": "javascript",
            "source_code": "console.log()",
            "visibility": "public"
        }, headers=headers_a)
        share_b_id = res2.json()["share_id"]

        # Add mock views and forks directly
        await db_instance.db.shared_codes.update_one({"share_id": share_a_id}, {"$set": {"views": 10, "forks": 5}})
        await db_instance.db.shared_codes.update_one({"share_id": share_b_id}, {"$set": {"views": 20, "forks": 2}})

        # Retrieve analytics
        res_analytics = await ac.get("/api/share/my/analytics", headers=headers_a)
        assert res_analytics.status_code == 200
        
        data = res_analytics.json()
        assert data["total_shares"] == 2
        assert data["total_views"] == 30
        assert data["total_forks"] == 7
        assert data["average_views"] == 15.0
        assert data["most_viewed"] == "Snipp B"
        assert data["most_forked"] == "Snipp A"

@pytest.mark.asyncio
async def test_challenge_solution_protection(test_db_setup):
    headers_a = test_db_setup["user_a_headers"]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Share solution with visibility "public" => must override to "unlisted"
        res = await ac.post("/api/share", json={
            "title": "Challenge Solution Code",
            "language": "python",
            "source_code": "pass",
            "visibility": "public",
            "challenge_id": "challenge_1",
            "is_challenge_solution": True
        }, headers=headers_a)
        
        assert res.status_code == 201
        assert res.json()["visibility"] == "unlisted"

        # Update solution visibility to public should fail
        share_id = res.json()["share_id"]
        res_update = await ac.put(f"/api/share/{share_id}", json={
            "visibility": "public"
        }, headers=headers_a)
        
        assert res_update.status_code == 400
        assert "must remain unlisted" in res_update.json()["detail"]
