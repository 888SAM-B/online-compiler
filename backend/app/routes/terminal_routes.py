import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from typing import List, Optional

from app.auth import get_current_user
from app.database import get_db
from app.services.terminal_manager import terminal_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["terminal"])

class TerminalStartRequest(BaseModel):
    language: str
    code: str

# GET /api/terminal/active
@router.get("/api/terminal/active")
async def get_active_terminal_session(current_user: dict = Depends(get_current_user)):
    session = await terminal_manager.get_active_session(current_user["id"])
    if not session:
        return {"session_id": None, "status": None}
    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "language": session["language"]
    }

# POST /api/terminal/start
@router.post("/api/terminal/start")
async def start_terminal_session(
    req: TerminalStartRequest,
    current_user: dict = Depends(get_current_user)
):
    session_id = await terminal_manager.create_session(
        user_id=current_user["id"],
        language=req.language,
        code=req.code
    )
    return {"session_id": session_id}

# POST /api/terminal/{session_id}/stop
@router.post("/api/terminal/{session_id}/stop")
async def stop_terminal_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    r = await terminal_manager.get_redis()
    meta = await r.hgetall(f"terminal:session:{session_id}")
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terminal session not found or already completed."
        )
    if meta["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this session."
        )
    
    await terminal_manager.stop_session(session_id)
    return {"message": "Termination signal sent."}

# GET /api/terminal/history
@router.get("/api/terminal/history")
async def get_terminal_history(current_user: dict = Depends(get_current_user)):
    history = await terminal_manager.get_session_history(current_user["id"])
    return history

# WebSocket /ws/terminal/{session_id}
@router.websocket("/ws/terminal/{session_id}")
async def ws_terminal(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    r = await terminal_manager.get_redis()
    meta = await r.hgetall(f"terminal:session:{session_id}")
    if not meta:
        await websocket.send_json({
            "type": "stderr",
            "data": "Session not found or already closed."
        })
        await websocket.close()
        return

    # Send current status
    await websocket.send_json({
        "type": "status",
        "status": meta["status"]
    })

    # Replay history buffer if exists
    history = await r.get(f"terminal:session:{session_id}:history")
    if history:
        await websocket.send_json({
            "type": "stdout",
            "data": history
        })

    pubsub = r.pubsub()
    await pubsub.subscribe(f"session_events:{session_id}")

    # Task to forward Redis Pub/Sub events to WebSocket
    async def redis_to_ws():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    evt = json.loads(message["data"])
                    await websocket.send_json(evt)
                    # If exit event, exit loop
                    if evt.get("type") == "exit":
                        break
        except Exception as e:
            logger.debug(f"Redis to WS error: {e}")
        finally:
            try:
                await websocket.close()
            except Exception:
                pass

    # Task to forward WebSocket stdin to Redis Pub/Sub
    async def ws_to_redis():
        try:
            while True:
                data = await websocket.receive_text()
                evt = json.loads(data)
                if evt.get("type") in ["stdin", "terminate"]:
                    await r.publish(f"session_stdin:{session_id}", json.dumps(evt))
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.debug(f"WS to Redis error: {e}")

    try:
        await asyncio.gather(
            redis_to_ws(),
            ws_to_redis()
        )
    finally:
        try:
            await pubsub.unsubscribe(f"session_events:{session_id}")
        except Exception:
            pass
