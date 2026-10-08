from __future__ import annotations

import json
import unittest
from unittest.mock import patch

import httpx

from backend.insights import GeminiServiceError, generate_insights
from backend.models import InsightsRequest


class GeminiServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_request_keeps_key_in_header_and_omits_private_fields(self) -> None:
        captured: dict[str, object] = {}

        async def respond(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            captured["api_key"] = request.headers.get("x-goog-api-key")
            body = json.loads(request.content)
            captured["body"] = body
            prompt = json.loads(body["contents"][0]["parts"][0]["text"])
            captured["prompt"] = prompt
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {
                                        "text": json.dumps(
                                            {
                                                "summary": "Build on your current strengths.",
                                                "recommendations": [
                                                    {"skill": "react", "action": "Build a small project."}
                                                ],
                                                "first_week_plan": ["Review the basics."],
                                            }
                                        )
                                    }
                                ]
                            }
                        }
                    ]
                },
            )

        transport = httpx.MockTransport(respond)
        original_client = httpx.AsyncClient
        with patch(
            "backend.insights.httpx.AsyncClient",
            side_effect=lambda **kwargs: original_client(transport=transport, **kwargs),
        ):
            result = await generate_insights(
                InsightsRequest(
                    jobTitle="Frontend Developer",
                    score=75,
                    matched=["javascript"],
                    gaps=["react"],
                    profile=[{"skill": "javascript", "level": 4, "years": 2}],
                ),
                "secret-test-key",
                "gemini-test",
            )

        self.assertEqual(result.summary, "Build on your current strengths.")
        self.assertEqual(captured["api_key"], "secret-test-key")
        self.assertEqual(
            captured["url"],
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent",
        )
        self.assertEqual(
            captured["prompt"],
            {
                "job_title": "Frontend Developer",
                "readiness_score": 75,
                "matched_skills": ["javascript"],
                "partial_skills": [],
                "missing_skills": ["react"],
                "current_skills": [{"skill": "javascript", "level": 4, "years": 2}],
            },
        )

    async def test_free_tier_quota_error_is_reported_without_upstream_details(self) -> None:
        async def respond(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(429, text="provider details")

        transport = httpx.MockTransport(respond)
        original_client = httpx.AsyncClient
        with patch(
            "backend.insights.httpx.AsyncClient",
            side_effect=lambda **kwargs: original_client(transport=transport, **kwargs),
        ):
            with self.assertRaises(GeminiServiceError) as error:
                await generate_insights(InsightsRequest(), "secret-test-key", "gemini-test")

        self.assertEqual(error.exception.status_code, 503)
        self.assertNotIn("provider details", str(error.exception))

    async def test_invalid_model_response_is_reported_as_bad_gateway(self) -> None:
        async def respond(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"candidates": [{}]})

        transport = httpx.MockTransport(respond)
        original_client = httpx.AsyncClient
        with patch(
            "backend.insights.httpx.AsyncClient",
            side_effect=lambda **kwargs: original_client(transport=transport, **kwargs),
        ):
            with self.assertRaises(GeminiServiceError) as error:
                await generate_insights(InsightsRequest(), "secret-test-key", "gemini-test")

        self.assertEqual(error.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
