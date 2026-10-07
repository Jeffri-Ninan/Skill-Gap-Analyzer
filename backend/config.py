from __future__ import annotations

import hashlib
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
    vercel_env = os.getenv("VERCEL_ENV", "").strip().lower()
    environment = os.getenv("APP_ENV", "production" if vercel_env == "production" else "development").strip().lower()
    is_prod = environment == "production" or vercel_env == "production"

    # Detect base URL from APP_BASE_URL or cloud provider environment (Vercel, Render, etc.)
    base_url = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        vercel_url = (
            os.getenv("VERCEL_PROJECT_PRODUCTION_URL", "").strip()
            or os.getenv("VERCEL_URL", "").strip()
        ).rstrip("/")
        render_url = os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
        render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip().rstrip("/")
        if vercel_url:
            base_url = f"https://{vercel_url}" if not vercel_url.startswith("http") else vercel_url
        elif render_url:
            base_url = render_url
        elif render_host:
            base_url = f"https://{render_host}"
        elif is_prod:
            base_url = "https://skill-gap-analyzer.vercel.app"
        else:
            base_url = "http://localhost:8000"

    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}:
        raise RuntimeError("APP_BASE_URL must be an absolute HTTP(S) URL.")
    if is_prod and parsed.scheme != "https":
        raise RuntimeError("APP_BASE_URL must use HTTPS in production.")

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = (
        os.getenv("SUPABASE_KEY", "")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.getenv("SUPABASE_ANON_KEY", "")
    ).strip()

    secret = os.getenv("SESSION_SECRET", "").strip()
    if not secret:
        if supabase_key:
            # Deterministic strong secret derived from Supabase key so serverless cold starts share the same session secret
            secret = hashlib.sha256(f"skillgap-session-salt:{supabase_key}".encode()).hexdigest()
        elif is_prod:
            secret = secrets.token_urlsafe(48)
        else:
            secret = "development-only-session-secret-change-before-deploy"
    elif is_prod and len(secret) < 32:
        secret = hashlib.sha256(secret.encode()).hexdigest()

    return Settings(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        session_secret=secret,
        app_base_url=base_url,
        github_client_id=os.getenv("GITHUB_CLIENT_ID"),
        github_client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
        environment=environment,
    )
