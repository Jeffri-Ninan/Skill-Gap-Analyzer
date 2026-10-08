from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from authlib.integrations.starlette_client import OAuth, OAuthError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from httpx import HTTPError
from starlette.middleware.sessions import SessionMiddleware
from starlette.types import Scope

from .config import load_settings
from .database import (
    DatabaseError,
    DatabaseInterface,
    DuplicateUserError,
    create_database,
)
from .insights import GeminiServiceError, generate_insights
from .models import AIInsights, AccountResponse, AppData, AppDataPayload, Credentials, InsightsRequest
from .security import hash_password, normalize_email, verify_password

load_dotenv()
settings = load_settings()
oauth = OAuth()
if settings.github_client_id and settings.github_client_secret:
    oauth.register(
        name="github",
        client_id=settings.github_client_id,
        client_secret=settings.github_client_secret,
        access_token_url="https://github.com/login/oauth/access_token",
        access_token_params=None,
        authorize_url="https://github.com/login/oauth/authorize",
        authorize_params=None,
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )

db: DatabaseInterface = create_database(settings)
frontend_directory = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        if hasattr(db, "initialize"):
            await db.initialize()
        await db.ping()
    except Exception as exc:
        import logging
        logging.getLogger("skillgap").warning("Startup database check warning: %s", exc)
    yield
    try:
        await db.close()
    except Exception:
        pass


app = FastAPI(title="Skill Gap Analyzer API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="skillgap_session",
    max_age=60 * 60 * 24 * 14,
    same_site="lax",
    https_only=settings.production,
)


def account_response(user: dict) -> AccountResponse:
    return AccountResponse(
        id=str(user["id"]),
        email=user["email"],
        name=user.get("name"),
        provider="github" if user.get("github_id") else "email",
    )


async def authenticated_user(request: Request) -> dict:
    user_id = request.session.get("user_id")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in.")

    user = await db.get_user_by_id(user_id)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")
    return user


async def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    expected = urlparse(settings.app_base_url)
    actual = urlparse(origin)
    if actual.scheme == expected.scheme and actual.netloc.casefold() == expected.netloc.casefold():
        return
    if actual.netloc.casefold().endswith(".onrender.com"):
        return
    if actual.netloc.casefold().endswith(".vercel.app"):
        return
    if actual.netloc.casefold().endswith(".netlify.app"):
        return
    if actual.netloc.casefold() in {"localhost:8000", "127.0.0.1:8000", "localhost", "127.0.0.1"}:
        return
    raise HTTPException(status_code=403, detail="Cross-origin request rejected.")


@app.get("/api/health")
async def health() -> dict[str, str]:
    is_healthy = await db.ping()
    return {
        "status": "ok" if is_healthy else "degraded",
        "database": "supabase" if settings.has_supabase else "local",
    }


@app.post("/api/insights", response_model=AIInsights)
async def get_ai_insights(
    payload: InsightsRequest,
    request: Request,
    _: dict = Depends(authenticated_user),
) -> AIInsights:
    await require_same_origin(request)
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="AI guidance is not configured. Set GEMINI_API_KEY on the backend.")
    try:
        return await generate_insights(payload, settings.gemini_api_key, settings.gemini_model)
    except GeminiServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@app.get("/")
async def frontend_index() -> FileResponse:
    return FileResponse(frontend_directory / "index.html", media_type="text/html")


@app.post("/api/auth/register", response_model=AccountResponse, status_code=201)
async def register(payload: Credentials, request: Request) -> AccountResponse:
    await require_same_origin(request)
    try:
        email = normalize_email(payload.email)
        password_hash = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        user = await db.create_user(email=email, password_hash=password_hash)
    except DuplicateUserError as exc:
        raise HTTPException(status_code=409, detail="An account with that email already exists.") from exc
    except DatabaseError as exc:
        raise HTTPException(status_code=500, detail="Database error occurred.") from exc

    request.session.clear()
    request.session["user_id"] = str(user["id"])
    return account_response(user)


@app.post("/api/auth/login", response_model=AccountResponse)
async def login(payload: Credentials, request: Request) -> AccountResponse:
    await require_same_origin(request)
    try:
        email = normalize_email(payload.email)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    user = await db.get_user_by_email(email)
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")

    request.session.clear()
    request.session["user_id"] = str(user["id"])
    return account_response(user)


@app.get("/api/auth/me", response_model=AccountResponse)
async def current_account(user: dict = Depends(authenticated_user)) -> AccountResponse:
    return account_response(user)


@app.post("/api/auth/logout", status_code=204)
async def logout(request: Request, _: dict = Depends(authenticated_user)) -> Response:
    await require_same_origin(request)
    request.session.clear()
    return Response(status_code=204)


@app.get("/api/auth/github")
async def github_login(request: Request) -> RedirectResponse:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=503, detail="GitHub sign-in is not configured yet.")
    callback = f"{settings.app_base_url}/api/auth/github/callback"
    return await oauth.github.authorize_redirect(request, callback)


@app.get("/api/auth/github/callback")
async def github_callback(request: Request) -> RedirectResponse:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=503, detail="GitHub sign-in is not configured yet.")
    try:
        token = await oauth.github.authorize_access_token(request)
        profile = await oauth.github.get("user", token=token)
        emails_response = await oauth.github.get("user/emails", token=token)
        profile.raise_for_status()
        emails_response.raise_for_status()
    except (OAuthError, HTTPError, OSError) as exc:
        raise HTTPException(status_code=401, detail="GitHub sign-in could not be completed.") from exc

    github_user = profile.json()
    verified_email = next(
        (
            item["email"]
            for item in emails_response.json()
            if item.get("verified") and item.get("primary")
        ),
        None,
    )
    if not verified_email:
        raise HTTPException(status_code=400, detail="Your GitHub account needs a verified primary email address.")
    try:
        verified_email = normalize_email(verified_email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="GitHub did not provide a valid primary email address.") from exc

    user = await db.get_user_by_github_id(github_user["id"])
    if not user:
        try:
            user = await db.create_user(
                email=verified_email,
                github_id=github_user["id"],
                name=github_user.get("name") or github_user.get("login"),
            )
        except DuplicateUserError as exc:
            raise HTTPException(
                status_code=409,
                detail="That email already has an account. Sign in with email and password instead.",
            ) from exc

    request.session.clear()
    request.session["user_id"] = str(user["id"])
    return RedirectResponse(f"{settings.app_base_url}/#/profile", status_code=303)


@app.get("/api/data")
async def get_app_data(user: dict = Depends(authenticated_user)) -> dict:
    record = await db.get_user_data(user["id"])
    if not record:
        return {"data": {"profile": [], "analyses": [], "plan": [], "settings": {"theme": "dark"}}}
    if record.get("schema_version") != 1:
        raise HTTPException(status_code=500, detail="Saved account data has an unsupported version.")
    return {"data": json.loads(record["data_json"])}


@app.put("/api/data")
async def save_app_data(
    payload: AppDataPayload,
    request: Request,
    user: dict = Depends(authenticated_user),
) -> dict[str, str]:
    await require_same_origin(request)
    serialized = payload.data.model_dump_json(exclude_none=True)
    if len(serialized) > 5_000_000:
        raise HTTPException(status_code=413, detail="Your saved data exceeds the 5 MB limit.")

    await db.save_user_data(user["id"], serialized, schema_version=1)
    return {"status": "saved"}


@app.delete("/api/data", status_code=204)
async def reset_app_data(
    request: Request,
    user: dict = Depends(authenticated_user),
) -> Response:
    await require_same_origin(request)
    await db.delete_user_data(user["id"])
    return Response(status_code=204)


@app.get("/api/auth/github/status")
async def github_status() -> dict[str, bool]:
    return {"enabled": bool(settings.github_client_id and settings.github_client_secret)}


class FrontendFiles(StaticFiles):
    allowed_files = {
        "index.html",
        "styles.css",
        "js/analyzer.js",
        "js/api.js",
        "js/app.js",
        "js/extractor.js",
        "js/radar.js",
        "js/router.js",
        "js/skills-data.js",
        "js/storage.js",
    }

    async def get_response(self, path: str, scope: Scope) -> Response:
        path = path.replace("\\", "/")
        if path == "":
            path = "index.html"
        if path not in self.allowed_files or path == "":
            from starlette.exceptions import HTTPException as StarletteHTTPException

            raise StarletteHTTPException(status_code=404)
        return await super().get_response(path, scope)


app.mount("/", FrontendFiles(directory=frontend_directory, html=True, check_dir=False), name="frontend")
