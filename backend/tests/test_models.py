from __future__ import annotations

import unittest
from unittest.mock import patch

from pydantic import ValidationError

from backend.config import load_settings
from backend.models import AppData, Credentials
from backend.security import hash_password, normalize_email, verify_password


def valid_data() -> dict:
    return {
        "profile": [{"skill": "react", "level": 4, "years": 2}],
        "analyses": [
            {
                "id": "analysis-1",
                "date": "2026-09-30T10:00:00.000Z",
                "jobTitle": "Frontend Developer",
                "company": "Example",
                "score": 80,
                "matched": ["react"],
                "partial": [],
                "gaps": [{"skill": "next.js", "weight": 2}],
                "jdText": "React frontend developer requirements.",
                "extracted": [
                    {
                        "skill": "react",
                        "category": "Frontend",
                        "mentions": 1,
                        "inRequiredSection": True,
                        "inOptionalSection": False,
                        "inTitle": True,
                        "yearsRequired": 0,
                        "weight": 6,
                        "learningHours": 40,
                        "related": ["javascript"],
                        "resources": ["React documentation"],
                    }
                ],
                "profileSnapshot": [{"skill": "react", "level": 4, "years": 2}],
            }
        ],
        "plan": [{"skill": "next.js", "done": False, "targetDate": "2026-10-30"}],
        "settings": {"theme": "dark"},
    }


class SecurityTests(unittest.TestCase):
    def test_production_settings_require_https_and_a_strong_secret(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "APP_ENV": "production",
                "APP_BASE_URL": "https://skill-gap.example",
                "SESSION_SECRET": "x" * 48,
            },
            clear=True,
        ):
            self.assertTrue(load_settings().production)
        with patch.dict(
            "os.environ",
            {
                "APP_ENV": "production",
                "APP_BASE_URL": "http://skill-gap.example",
                "SESSION_SECRET": "x" * 48,
            },
            clear=True,
        ):
            with self.assertRaises(RuntimeError):
                load_settings()

    def test_passwords_are_hashed_and_verified(self) -> None:
        hashed = hash_password("correct horse battery")
        self.assertNotEqual(hashed, "correct horse battery")
        self.assertTrue(verify_password("correct horse battery", hashed))
        self.assertFalse(verify_password("incorrect password", hashed))

    def test_email_normalization(self) -> None:
        self.assertEqual(normalize_email("  USER@Example.com "), "user@example.com")
        with self.assertRaises(ValueError):
            normalize_email("not-an-email")

    def test_credentials_reject_short_passwords(self) -> None:
        with self.assertRaises(ValidationError):
            Credentials(email="person@example.com", password="short")


class AppDataTests(unittest.TestCase):
    def test_valid_data_round_trips(self) -> None:
        data = AppData.model_validate(valid_data())
        self.assertEqual(data.profile[0].skill, "react")
        self.assertEqual(data.analyses[0].score, 80)
        self.assertTrue(data.analyses[0].extracted[0].inRequiredSection)

    def test_duplicate_profile_skills_are_rejected_case_insensitively(self) -> None:
        payload = valid_data()
        payload["profile"].append({"skill": "React", "level": 3, "years": 1})
        with self.assertRaises(ValidationError):
            AppData.model_validate(payload)

    def test_job_description_size_is_bounded(self) -> None:
        payload = valid_data()
        payload["analyses"][0]["jdText"] = "x" * 50_001
        with self.assertRaises(ValidationError):
            AppData.model_validate(payload)


if __name__ == "__main__":
    unittest.main()
