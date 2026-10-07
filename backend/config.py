from __future__ import annotations

import os
import secrets
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
    is_prod = environment == "production"

    # Detect base URL from APP_BASE_URL or cloud provider environment (Render, etc.)
    base_url = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        render_url = os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
        render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip().rstrip("/")
        if render_url:
            base_url = render_url
        elif render_host:
            base_url = f"https://{render_host}"
        elif is_prod:
            base_url = "https://skill-gap-analyzer.onrender.com"
        else:
            base_url = "http://localhost:8000"

    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}:
        raise RuntimeError("APP_BASE_URL must be an absolute HTTP(S) URL.")
    if is_prod and parsed.scheme != "https":
        raise RuntimeError("APP_BASE_URL must use HTTPS in production.")

    secret = os.getenv("SESSION_SECRET", "").strip()
    if is_prod and len(secret) < 32:
        # In cloud environments, if SESSION_SECRET wasn't set, auto-generate a strong secret instead of crashing
        secret = secrets.token_urlsafe(48)
    elif not secret:
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
