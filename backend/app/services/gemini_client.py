import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

async def call_gemini(prompt: str, json_response: bool = False) -> str:
    """
    Sends a prompt to Google Gemini API and returns the generated text.
    Uses httpx.AsyncClient with a 30.0s timeout.
    """
    # Parse comma-separated list of keys for rotation/failover
    api_keys = [k.strip() for k in settings.GEMINI_API_KEY.split(",") if k.strip()]
    if not api_keys:
        logger.error("No valid GEMINI_API_KEY configured")
        raise ValueError("AI API key is missing or not configured.")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ]
    }

    if json_response:
        payload["generationConfig"] = {
            "responseMimeType": "application/json"
        }

    async with httpx.AsyncClient() as client:
        last_exception = None
        for i, api_key in enumerate(api_keys):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
            try:
                response = await client.post(url, json=payload, timeout=30.0)
                
                # Check for rate limiting (429) or forbidden project blocks (403) to trigger failover
                if response.status_code in (429, 403, 500, 502, 503, 504):
                    logger.warning(
                        f"Gemini API key index {i} failed with status {response.status_code}. "
                        "Attempting failover to next key..."
                    )
                    continue

                response.raise_for_status()
                result = response.json()
                
                # Extract content from response
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                return text
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Gemini API HTTP Error {e.response.status_code} with key at index {i}: {e.response.text}")
                last_exception = e
            except Exception as e:
                logger.error(f"Failed to communicate with Gemini API using key at index {i}: {e}")
                last_exception = e
                
        # If all configured keys failed
        logger.error("All configured Gemini API keys failed or exhausted quota limit.")
        if last_exception:
            raise last_exception
        raise RuntimeError("Failed to communicate with Gemini API.")

