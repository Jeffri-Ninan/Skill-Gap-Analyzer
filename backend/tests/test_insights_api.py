from __future__ import annotations

import unittest
from contextlib import asynccontextmanager
from dataclasses import replace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import backend.main as api
from backend.database import MemoryDatabase
from backend.models import AIInsights, InsightRecommendation


@asynccontextmanager
async def no_database_lifespan(_app):
    yield


class InsightsEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        api.app.router.lifespan_context = no_database_lifespan

    def setUp(self) -> None:
        api.db = MemoryDatabase()
        self.settings_patch = patch(
            "backend.main.settings",
            replace(api.settings, gemini_api_key=None, gemini_model="gemini-test"),
        )
        self.settings_patch.start()
        self.client = TestClient(api.app)

    def tearDown(self) -> None:
        self.client.close()
        self.settings_patch.stop()

    def register(self) -> None:
        response = self.client.post(
            "/api/auth/register",
            json={"email": "person@example.com", "password": "secure-password-1"},
        )
        self.assertEqual(response.status_code, 201, response.text)

    def test_guidance_requires_an_authenticated_session(self) -> None:
        response = self.client.post("/api/insights", json={})
        self.assertEqual(response.status_code, 401)

    def test_guidance_reports_missing_api_key(self) -> None:
        self.register()
        response = self.client.post("/api/insights", json={})
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.json()["detail"])

    def test_guidance_returns_validated_recommendations(self) -> None:
        self.register()
        expected = AIInsights(
            summary="Build on your JavaScript experience.",
            recommendations=[InsightRecommendation(skill="react", action="Build a small component.")],
            first_week_plan=["Review component fundamentals.", "Build and test a small component."],
        )
        payload = {
            "jobTitle": "Frontend Developer",
            "score": 70,
            "matched": ["javascript"],
            "partial": [],
            "gaps": ["react"],
            "profile": [{"skill": "javascript", "level": 4, "years": 2}],
        }
        with (
            patch(
                "backend.main.settings",
                replace(api.settings, gemini_api_key="test-key", gemini_model="gemini-test"),
            ),
            patch("backend.main.generate_insights", new_callable=AsyncMock, return_value=expected) as generate,
        ):
            response = self.client.post("/api/insights", json=payload)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), expected.model_dump())
        generate.assert_awaited_once()
        request_payload, api_key, model = generate.await_args.args
        self.assertEqual(request_payload.jobTitle, payload["jobTitle"])
        self.assertEqual(request_payload.gaps, payload["gaps"])
        self.assertEqual(api_key, "test-key")
        self.assertEqual(model, "gemini-test")

    def test_guidance_rejects_cross_origin_requests(self) -> None:
        self.register()
        response = self.client.post(
            "/api/insights",
            headers={"origin": "https://attacker.example"},
            json={},
        )
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
