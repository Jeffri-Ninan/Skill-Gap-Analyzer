from __future__ import annotations

import unittest
from contextlib import asynccontextmanager

from fastapi.testclient import TestClient

import backend.main as api
from backend.database import MemoryDatabase


@asynccontextmanager
async def no_database_lifespan(_app):
    yield


class AuthenticatedApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        api.app.router.lifespan_context = no_database_lifespan

    def setUp(self) -> None:
        api.db = MemoryDatabase()
        self.first = TestClient(api.app)
        self.second = TestClient(api.app)

    def tearDown(self) -> None:
        self.first.close()
        self.second.close()

    def register(self, client: TestClient, email: str) -> None:
        response = client.post("/api/auth/register", json={"email": email, "password": "secure-password-1"})
        self.assertEqual(response.status_code, 201, response.text)

    def test_registration_and_session_are_account_scoped(self) -> None:
        self.register(self.first, "first@example.com")
        self.register(self.second, "second@example.com")
        first_state = {
            "profile": [{"skill": "react", "level": 4, "years": 2}],
            "analyses": [],
            "plan": [],
            "settings": {"theme": "light"},
        }
        saved = self.first.put("/api/data", json={"data": first_state})
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(self.first.get("/api/data").json()["data"], first_state)
        self.assertEqual(
            self.second.get("/api/data").json()["data"],
            {"profile": [], "analyses": [], "plan": [], "settings": {"theme": "dark"}},
        )

    def test_login_and_logout(self) -> None:
        self.register(self.first, "person@example.com")
        self.first.post("/api/auth/logout")
        self.assertEqual(self.first.get("/api/data").status_code, 401)
        response = self.first.post("/api/auth/login", json={"email": "PERSON@example.com", "password": "secure-password-1"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.first.get("/api/auth/me").json()["email"], "person@example.com")

    def test_cross_origin_mutations_are_rejected(self) -> None:
        self.register(self.first, "person@example.com")
        response = self.first.put(
            "/api/data",
            headers={"origin": "https://attacker.example"},
            json={"data": {"profile": [], "analyses": [], "plan": [], "settings": {"theme": "dark"}}},
        )
        self.assertEqual(response.status_code, 403)

    def test_backend_source_is_not_served_as_static_content(self) -> None:
        self.assertEqual(self.first.get("/backend/main.py").status_code, 404)
        self.assertEqual(self.first.get("/requirements.txt").status_code, 404)
        self.assertEqual(self.first.get("/").status_code, 200)
        self.assertEqual(self.first.get("/js/app.js").status_code, 200)

    def test_github_sign_in_is_reported_as_disabled_without_credentials(self) -> None:
        self.assertEqual(self.first.get("/api/auth/github/status").json(), {"enabled": False})
        self.assertEqual(self.first.get("/api/auth/github").status_code, 503)

    def test_health_check_returns_ok(self) -> None:
        response = self.first.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")


if __name__ == "__main__":
    unittest.main()
