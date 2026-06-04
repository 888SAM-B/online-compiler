import hashlib
import logging
from datetime import datetime, timedelta
from bson import ObjectId
from app.database import get_db
from app.services.gemini_client import call_gemini
from app.utils.copilot_prompts import COPILOT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ["python", "javascript", "java", "cpp", "c"]

def validate_suggest_inputs(code: str, language: str):
    """
    Validates the programming language and text length for inline suggestions.
    """
    lang_lower = language.lower()
    if lang_lower not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Language '{language}' is not supported for inline suggestions.")
    
    if len(code) > 5000:
        raise ValueError("Request code context size exceeds the 5000 character limit.")
        
    return lang_lower

def generate_suggest_cache_key(language: str, context_before_cursor: str) -> str:
    """
    Computes a unique SHA-256 hash based on the language and the last 1000 characters before the cursor.
    """
    raw_key = f"SUGGEST:{language.lower()}:{context_before_cursor}"
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

async def get_cached_suggestion(cache_key: str) -> str:
    """
    Attempts to retrieve a cached autocomplete suggestion from the database.
    """
    try:
        db = get_db()
        if db is not None:
            cached = await db.ai_suggestion_cache.find_one({
                "cache_key": cache_key,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            if cached:
                logger.info(f"Suggestion cache hit for key: {cache_key}")
                return cached["suggestion"]
    except Exception as e:
        logger.warning(f"Failed to query suggestion cache: {e}")
    return None

async def save_suggestion_cache(cache_key: str, language: str, suggestion: str):
    """
    Saves a generated code suggestion to MongoDB suggestion cache with a 24-hour expiration TTL.
    """
    try:
        db = get_db()
        if db is not None:
            expires_at = datetime.utcnow() + timedelta(hours=24)
            await db.ai_suggestion_cache.update_one(
                {"cache_key": cache_key},
                {
                    "$set": {
                        "cache_key": cache_key,
                        "language": language.lower(),
                        "suggestion": suggestion,
                        "expires_at": expires_at,
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.info(f"Saved suggestion to cache under key: {cache_key}")
    except Exception as e:
        logger.warning(f"Failed to save suggestion to cache: {e}")

async def log_suggestion_usage(user_id: str, language: str):
    """
    Logs inline suggestion consumption to MongoDB.
    """
    try:
        db = get_db()
        if db is not None:
            log_entry = {
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "feature": "AI_INLINE_SUGGESTION",
                "language": language.lower(),
                "created_at": datetime.utcnow()
            }
            await db.ai_usage_logs.insert_one(log_entry)
    except Exception as e:
        logger.error(f"Failed to log suggestion usage: {e}")

def clean_suggestion(suggestion: str) -> str:
    """
    Strips code fences, markdown structures, and trims completion output to at most 30 lines.
    Preserves leading indentation spaces.
    """
    cleaned = suggestion.strip("\r\n")
    
    # Strip markdown code fences if Gemini included them
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
        
    cleaned = cleaned.strip("\r\n")
        
    # Trim to maximum 30 lines
    lines = cleaned.split("\n")
    if len(lines) > 30:
        lines = lines[:30]
        cleaned = "\n".join(lines)
        
    return cleaned


async def generate_inline_suggestion(code: str, language: str, cursor_position: int, user_id: str, email: str, ip_address: str) -> dict:
    """
    Orchestrates the inline code completion suggestion generation flow.
    """
    # 1. Input validation
    language = validate_suggest_inputs(code, language)
    
    # 2. Extract cache key based on the last 1000 characters before the cursor
    context_before = code[max(0, cursor_position - 1000):cursor_position]
    cache_key = generate_suggest_cache_key(language, context_before)
    
    # 3. Cache lookup
    cached_val = await get_cached_suggestion(cache_key)
    if cached_val is not None:
        return {
            "success": True,
            "suggestion": cached_val,
            "source": "gemini",
            "cached": True
        }
        
    # 4. Splicing context for Gemini
    prefix = code[:cursor_position]
    suffix = code[cursor_position:]
    prompt = f"{COPILOT_SYSTEM_PROMPT}\n\nFile Content:\n{prefix}<<<CURSOR>>>{suffix}"
    
    # 5. Call Gemini
    try:
        raw_result = await call_gemini(prompt, json_response=False)
        suggestion = clean_suggestion(raw_result)
    except Exception as e:
        logger.error(f"Failed to generate inline suggestion: {e}")
        raise RuntimeError("AI suggestion unavailable.")
        
    # 6. Save cache & log usage (on cache miss)
    await save_suggestion_cache(cache_key, language, suggestion)
    await log_suggestion_usage(user_id, language)
    
    return {
        "success": True,
        "suggestion": suggestion,
        "source": "gemini",
        "cached": False
    }
