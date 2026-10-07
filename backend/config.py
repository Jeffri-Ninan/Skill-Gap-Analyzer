from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_key: str
    session_secret: str
    app_base_url: str
    github_client_id: str | None
    github_client_secret: str | None
    environment: str

    @property
    def production(self) -> bool:
        return self.environment == "production"

    @property
    def has_supabase(self) -> bool:
        return bool(
            self.supabase_url
            and self.supabase_key
            and not self.supabase_url.startswith("https://your-project")
        )


def load_settings() -> Settings:
    environment = os.getenv("APP_ENV", "development").strip().lower()
    base_url = os.getenv("APP_BASE_URL", "http://localhost:8000").rstrip("/")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}:
        raise RuntimeError("APP_BASE_URL must be an absolute HTTP(S) URL.")
    if environment == "production" and parsed.scheme != "https":
        raise RuntimeError("APP_BASE_URL must use HTTPS in production.")

    secret = os.getenv("SESSION_SECRET", "")
    if environment == "production" and len(secret) < 32:
        raise RuntimeError("Set SESSION_SECRET to a random value at least 32 characters long.")
    if not secret:
        secret = "development-only-session-secret-change-before-deploy"

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = (
        os.getenv("SUPABASE_KEY", "")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.getenv("SUPABASE_ANON_KEY", "")
    ).strip()

    return Settings(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        session_secret=secret,
        app_base_url=base_url,
        github_client_id=os.getenv("GITHUB_CLIENT_ID"),
        github_client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
        environment=environment,
    )
