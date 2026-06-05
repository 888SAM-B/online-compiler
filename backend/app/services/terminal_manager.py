import os
import uuid
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
import redis.asyncio as aioredis
from app.config import settings
from app.database import db_instance

logger = logging.getLogger(__name__)

class TerminalManager:
    def __init__(self):
        self.redis_client = None

    async def get_redis(self):
        if self.redis_client is None:
            self.redis_client = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
        return self.redis_client

    async def create_session(self, user_id: str, language: str, code: str) -> str:
        # Enforce max 1 active session per user
        active_session = await self.get_active_session(user_id)
        if active_session:
            logger.info(f"User {user_id} already has active session {active_session['session_id']}. Stopping it...")
            await self.stop_session(active_session['session_id'])

        # Generate session_id
        session_id = uuid.uuid4().hex
        started_at = datetime.utcnow()

        # Save session to MongoDB collection terminal_sessions
        db = db_instance.db
        session_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "language": language,
            "status": "PENDING",
            "container_id": "",
            "started_at": started_at,
            "ended_at": None,
            "execution_time_ms": 0
        }
        await db.terminal_sessions.insert_one(session_doc)

        # Store session metadata in Redis
        r = await self.get_redis()
        session_meta = {
            "session_id": session_id,
            "user_id": user_id,
            "language": language,
            "status": "PENDING",
            "container_id": "",
            "created_at": started_at.isoformat(),
            "last_activity": started_at.isoformat()
        }
        await r.hset(f"terminal:session:{session_id}", mapping=session_meta)
        await r.set(f"terminal:user_session:{user_id}", session_id)

        # Push to execution queue
        task = {
            "session_id": session_id,
            "user_id": user_id,
            "language": language,
            "code": code
        }
        await r.rpush("terminal:execution_queue", json.dumps(task))
        logger.info(f"Created terminal session {session_id} for user {user_id} and queued for execution.")
        
        return session_id

    async def get_active_session(self, user_id: str) -> Optional[dict]:
        r = await self.get_redis()
        session_id = await r.get(f"terminal:user_session:{user_id}")
        if not session_id:
            return None
        
        meta = await r.hgetall(f"terminal:session:{session_id}")
        if not meta:
            # Stale user session mapping
            await r.delete(f"terminal:user_session:{user_id}")
            return None
        
        return meta

    async def stop_session(self, session_id: str):
        r = await self.get_redis()
        meta = await r.hgetall(f"terminal:session:{session_id}")
        if not meta:
            return

        # Publish terminate event to notify worker
        await r.publish(f"session_stdin:{session_id}", json.dumps({
            "type": "terminate"
        }))
        logger.info(f"Sent terminate request for session {session_id}")

    async def update_session_status(self, session_id: str, status: str, container_id: Optional[str] = None):
        r = await self.get_redis()
        meta_key = f"terminal:session:{session_id}"
        
        if not await r.exists(meta_key):
            return

        updates = {
            "status": status,
            "last_activity": datetime.utcnow().isoformat()
        }
        if container_id is not None:
            updates["container_id"] = container_id

        await r.hset(meta_key, mapping=updates)

        # Update MongoDB
        db = db_instance.db
        mongo_updates = {
            "status": status
        }
        if container_id is not None:
            mongo_updates["container_id"] = container_id
            
        await db.terminal_sessions.update_one(
            {"session_id": session_id},
            {"$set": mongo_updates}
        )

    async def complete_session(self, session_id: str, status: str, exit_code: Optional[int] = None):
        r = await self.get_redis()
        meta = await r.hgetall(f"terminal:session:{session_id}")
        if not meta:
            return

        ended_at = datetime.utcnow()
        started_at = datetime.fromisoformat(meta["created_at"])
        execution_time_ms = int((ended_at - started_at).total_seconds() * 1000)

        # Update Mongo
        db = db_instance.db
        await db.terminal_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": status,
                "ended_at": ended_at,
                "execution_time_ms": execution_time_ms,
                "exit_code": exit_code
            }}
        )

        # Cleanup Redis
        user_id = meta["user_id"]
        await r.delete(f"terminal:session:{session_id}")
        await r.delete(f"terminal:user_session:{user_id}")
        logger.info(f"Cleaned up session {session_id} (Status: {status})")

    async def get_session_history(self, user_id: str) -> List[dict]:
        db = db_instance.db
        cursor = db.terminal_sessions.find({"user_id": user_id}).sort("started_at", -1)
        history = await cursor.to_list(length=100)
        
        # Serialize fields
        serialized = []
        for h in history:
            h["id"] = str(h["_id"])
            h.pop("_id", None)
            if h.get("started_at"):
                h["started_at"] = h["started_at"].isoformat()
            if h.get("ended_at"):
                h["ended_at"] = h["ended_at"].isoformat()
            serialized.append(h)
        return serialized

terminal_manager = TerminalManager()
