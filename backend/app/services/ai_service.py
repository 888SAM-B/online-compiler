import hashlib
import logging
import json
from datetime import datetime, timedelta
from bson import ObjectId
from app.database import get_db
from app.services.gemini_client import call_gemini
from app.utils.ai_prompts import EXPLAIN_PROMPT, DEBUG_PROMPT, GENERATE_PROMPT

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ["python", "javascript", "java", "cpp", "c"]

def validate_language(language: str):
    """
    Validates if the programming language is supported by the AI Code Assistant.
    """
    lang_lower = language.lower()
    if lang_lower not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Language '{language}' is not supported. Supported: {', '.join(SUPPORTED_LANGUAGES)}")
    return lang_lower

def generate_cache_key(feature: str, language: str, content: str) -> str:
    """
    Generates a unique SHA-256 cache key based on the feature, language, and content.
    """
    raw_key = f"{feature.upper()}:{language.lower()}:{content.strip()}"
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

async def get_cached_response(cache_key: str) -> str:
    """
    Attempts to retrieve a cached response from the database.
    """
    try:
        db = get_db()
        if db is not None:
            cached = await db.ai_cache.find_one({"cache_key": cache_key, "expires_at": {"$gt": datetime.utcnow()}})
            if cached:
                logger.info(f"Cache hit for key: {cache_key}")
                return cached["response"]
    except Exception as e:
        logger.warning(f"Failed to query AI cache: {e}")
    return None

async def save_cached_response(cache_key: str, response: str):
    """
    Saves a response to the AI cache with a 24-hour expiration time.
    """
    try:
        db = get_db()
        if db is not None:
            expires_at = datetime.utcnow() + timedelta(hours=24)
            await db.ai_cache.update_one(
                {"cache_key": cache_key},
                {
                    "$set": {
                        "cache_key": cache_key,
                        "response": response,
                        "expires_at": expires_at,
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.info(f"Saved response to AI cache under key: {cache_key}")
    except Exception as e:
        logger.warning(f"Failed to save to AI cache: {e}")

async def log_ai_usage(user_id: str, email: str, feature: str, language: str, prompt_len: int, response_len: int, ip_address: str):
    """
    Logs AI service consumption to MongoDB.
    """
    try:
        db = get_db()
        if db is not None:
            log_entry = {
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "email": email,
                "feature": feature.upper(),
                "language": language.lower(),
                "prompt_length": prompt_len,
                "response_length": response_len,
                "created_at": datetime.utcnow(),
                "ip_address": ip_address
            }
            await db.ai_usage_logs.insert_one(log_entry)
    except Exception as e:
        logger.error(f"Failed to save AI usage log: {e}")

async def generate_explanation(code: str, language: str, user_id: str, email: str, ip_address: str) -> str:
    """
    Exposes code explanation logic with caching and logging.
    """
    language = validate_language(language)
    cache_key = generate_cache_key("EXPLAIN", language, code)
    
    # 1. Try cache lookup
    cached = await get_cached_response(cache_key)
    if cached:
        return cached

    # 2. Build prompt & call Gemini
    prompt = EXPLAIN_PROMPT.format(language=language, code=code)
    try:
        explanation = await call_gemini(prompt, json_response=False)
    except Exception as e:
        logger.error(f"AI call failed: {e}")
        raise RuntimeError("AI service temporarily unavailable")

    # 3. Save to cache
    await save_cached_response(cache_key, explanation)

    # 4. Log usage (on cache miss)
    await log_ai_usage(
        user_id=user_id,
        email=email,
        feature="EXPLAIN",
        language=language,
        prompt_len=len(prompt),
        response_len=len(explanation),
        ip_address=ip_address
    )

    return explanation

async def debug_code(code: str, language: str, user_id: str, email: str, ip_address: str) -> dict:
    """
    Identifies code issues and bugs, returning structured JSON content.
    """
    language = validate_language(language)
    cache_key = generate_cache_key("DEBUG", language, code)

    # 1. Try cache lookup
    cached = await get_cached_response(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    # 2. Build prompt & call Gemini (requests JSON)
    prompt = DEBUG_PROMPT.format(language=language, code=code)
    try:
        raw_json_str = await call_gemini(prompt, json_response=True)
        # Parse it locally to ensure it is valid JSON
        parsed_result = json.loads(raw_json_str)
        # Standardize empty issues list if missing
        if "issues" not in parsed_result:
            parsed_result = {"issues": []}
    except Exception as e:
        logger.error(f"AI debug failed or returned invalid JSON: {e}")
        raise RuntimeError("AI service temporarily unavailable")

    # 3. Save to cache
    await save_cached_response(cache_key, json.dumps(parsed_result))

    # 4. Log usage (on cache miss)
    await log_ai_usage(
        user_id=user_id,
        email=email,
        feature="DEBUG",
        language=language,
        prompt_len=len(prompt),
        response_len=len(raw_json_str),
        ip_address=ip_address
    )

    return parsed_result

async def generate_code(user_prompt: str, language: str, user_id: str, email: str, ip_address: str) -> str:
    """
    Generates code based on the prompt description.
    """
    language = validate_language(language)
    cache_key = generate_cache_key("GENERATE", language, user_prompt)

    # 1. Try cache lookup
    cached = await get_cached_response(cache_key)
    if cached:
        return cached

    # 2. Build prompt & call Gemini
    prompt = GENERATE_PROMPT.format(language=language, prompt=user_prompt)
    try:
        generated = await call_gemini(prompt, json_response=False)
    except Exception as e:
        logger.error(f"AI generate failed: {e}")
        raise RuntimeError("AI service temporarily unavailable")

    # 3. Save to cache
    await save_cached_response(cache_key, generated)

    # 4. Log usage (on cache miss)
    await log_ai_usage(
        user_id=user_id,
        email=email,
        feature="GENERATE",
        language=language,
        prompt_len=len(prompt),
        response_len=len(generated),
        ip_address=ip_address
    )

    return generated
