from __future__ import annotations

import json
import logging
from urllib.parse import quote

import httpx

from .models import AIInsights, InsightsRequest

logger = logging.getLogger("skillgap.insights")

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING"},
        "recommendations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "skill": {"type": "STRING"},
                    "action": {"type": "STRING"},
                },
                "required": ["skill", "action"],
            },
        },
        "first_week_plan": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["summary", "recommendations", "first_week_plan"],
}


class GeminiServiceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


async def generate_insights(
    payload: InsightsRequest,
    api_key: str,
    model: str,
) -> AIInsights:
    prompt_data = {
        "job_title": payload.jobTitle,
        "readiness_score": payload.score,
        "matched_skills": payload.matched,
        "partial_skills": payload.partial,
        "missing_skills": payload.gaps[:10],
        "current_skills": [
            {"skill": skill.skill, "level": skill.level, "years": skill.years}
            for skill in payload.profile
        ],
    }
    request_body = {
        "systemInstruction": {
            "parts": [
                {
                    "text": (
                        "You are a practical career coach. Give specific, encouraging, realistic advice "
                        "based only on the supplied role and skill data. Do not invent qualifications or "
                        "guarantee hiring outcomes. Prioritize at most five missing skills and produce "
                        "a short, actionable plan for the first week."
                    )
                }
            ]
        },
        "contents": [{"parts": [{"text": json.dumps(prompt_data)}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 700,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{quote(model, safe='-_.')}:generateContent"
    )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0)) as client:
            response = await client.post(
                endpoint,
                headers={"x-goog-api-key": api_key},
                json=request_body,
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise GeminiServiceError(504, "Gemini took too long to respond. Please try again.") from exc
    except httpx.HTTPStatusError as exc:
        upstream_status = exc.response.status_code
        logger.warning("Gemini returned HTTP %s.", upstream_status)
        if upstream_status in {401, 403}:
            raise GeminiServiceError(503, "Gemini rejected the API key. Check GEMINI_API_KEY.") from exc
        if upstream_status == 429:
            raise GeminiServiceError(503, "Gemini's free-tier quota is currently unavailable. Try again later.") from exc
        raise GeminiServiceError(502, "Gemini could not generate guidance for this request.") from exc
    except httpx.RequestError as exc:
        logger.warning("Gemini request failed: %s", type(exc).__name__)
        raise GeminiServiceError(502, "Gemini could not be reached. Please try again.") from exc

    try:
        body = response.json()
        candidates = body.get("candidates") if isinstance(body, dict) else None
        candidate = candidates[0] if isinstance(candidates, list) and candidates else None
        content = candidate.get("content") if isinstance(candidate, dict) else None
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list):
            raise ValueError("Gemini response has no content parts.")
        generated_text = "".join(
            part["text"]
            for part in parts
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        )
        if not generated_text:
            raise ValueError("Gemini response has no text.")
        return AIInsights.model_validate_json(generated_text)
    except (ValueError, TypeError) as exc:
        raise GeminiServiceError(502, "Gemini returned an invalid guidance response.") from exc
