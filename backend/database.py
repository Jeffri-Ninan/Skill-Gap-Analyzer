from __future__ import annotations

import logging
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Protocol

import anyio
from postgrest.exceptions import APIError
from supabase import Client, create_client

from .config import Settings

logger = logging.getLogger("skillgap.database")


class DuplicateUserError(Exception):
    """Raised when trying to create a user with an email or GitHub ID that already exists."""


class DatabaseError(Exception):
    """Raised when an unrecoverable database error occurs."""


class DatabaseInterface(Protocol):
    async def get_user_by_email(self, email: str) -> dict[str, Any] | None: ...
    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None: ...
    async def get_user_by_github_id(self, github_id: int | str) -> dict[str, Any] | None: ...
    async def create_user(
        self,
        email: str,
        password_hash: str | None = None,
        github_id: int | str | None = None,
        name: str | None = None,
    ) -> dict[str, Any]: ...
    async def get_user_data(self, user_id: str) -> dict[str, Any] | None: ...
    async def save_user_data(
        self,
        user_id: str,
        data_json: str,
        schema_version: int = 1,
    ) -> None: ...
    async def delete_user_data(self, user_id: str) -> None: ...
    async def ping(self) -> bool: ...
    async def close(self) -> None: ...


class SupabaseDatabase:
    """Supabase PostgreSQL database adapter."""

    def __init__(self, supabase_url: str, supabase_key: str) -> None:
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.client: Client = create_client(self.supabase_url, self.supabase_key)

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        clean = email.strip().casefold()
        try:
            res = await anyio.to_thread.run_sync(
                lambda: self.client.table("users").select("*").eq("email", clean).limit(1).execute()
            )
            return res.data[0] if res.data else None
        except APIError as exc:
            raise DatabaseError(f"Failed to query user by email: {exc.message}") from exc

    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        try:
            res = await anyio.to_thread.run_sync(
                lambda: self.client.table("users").select("*").eq("id", user_id).limit(1).execute()
            )
            return res.data[0] if res.data else None
        except APIError as exc:
            raise DatabaseError(f"Failed to query user by id: {exc.message}") from exc

    async def get_user_by_github_id(self, github_id: int | str) -> dict[str, Any] | None:
        gid = str(github_id)
        try:
            res = await anyio.to_thread.run_sync(
                lambda: self.client.table("users").select("*").eq("github_id", gid).limit(1).execute()
            )
            return res.data[0] if res.data else None
        except APIError as exc:
            raise DatabaseError(f"Failed to query user by GitHub ID: {exc.message}") from exc

    async def create_user(
        self,
        email: str,
        password_hash: str | None = None,
        github_id: int | str | None = None,
        name: str | None = None,
    ) -> dict[str, Any]:
        user_id = str(uuid.uuid4())
        payload: dict[str, Any] = {
            "id": user_id,
            "email": email.strip().casefold(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if password_hash is not None:
            payload["password_hash"] = password_hash
        if github_id is not None:
            payload["github_id"] = str(github_id)
        if name is not None:
            payload["name"] = name

        try:
            res = await anyio.to_thread.run_sync(
                lambda: self.client.table("users").insert(payload).execute()
            )
            if res.data:
                return res.data[0]
            existing = await self.get_user_by_email(email)
            return existing or payload
        except APIError as exc:
            code = getattr(exc, "code", "")
            msg = getattr(exc, "message", "").lower()
            details = getattr(exc, "details", "").lower()
            if code == "23505" or "duplicate key" in msg or "already exists" in details:
                raise DuplicateUserError("An account with that email or GitHub identity already exists.") from exc
            raise DatabaseError(f"Failed to create user in Supabase: {exc.message}") from exc

    async def get_user_data(self, user_id: str) -> dict[str, Any] | None:
        try:
            res = await anyio.to_thread.run_sync(
                lambda: self.client.table("user_data").select("*").eq("user_id", user_id).limit(1).execute()
            )
            return res.data[0] if res.data else None
        except APIError as exc:
            raise DatabaseError(f"Failed to load user data from Supabase: {exc.message}") from exc

    async def save_user_data(
        self,
        user_id: str,
        data_json: str,
        schema_version: int = 1,
    ) -> None:
        record = {
            "user_id": user_id,
            "data_json": data_json,
            "schema_version": schema_version,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await anyio.to_thread.run_sync(
                lambda: self.client.table("user_data").upsert(record).execute()
            )
        except APIError as exc:
            raise DatabaseError(f"Failed to save user data in Supabase: {exc.message}") from exc

    async def delete_user_data(self, user_id: str) -> None:
        try:
            await anyio.to_thread.run_sync(
                lambda: self.client.table("user_data").delete().eq("user_id", user_id).execute()
            )
        except APIError as exc:
            raise DatabaseError(f"Failed to delete user data from Supabase: {exc.message}") from exc

    async def ping(self) -> bool:
        try:
            await anyio.to_thread.run_sync(
                lambda: self.client.table("users").select("id").limit(1).execute()
            )
            return True
        except Exception as exc:
            logger.warning("Supabase ping failed: %s", exc)
            return False

    async def close(self) -> None:
        pass


class MemoryDatabase:
    """In-memory database adapter for local testing and standalone execution."""

    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.user_data: dict[str, dict[str, Any]] = {}

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        clean = email.strip().casefold()
        for user in self.users.values():
            if user.get("email") == clean:
                return deepcopy(user)
        return None

    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        user = self.users.get(str(user_id))
        return deepcopy(user) if user else None

    async def get_user_by_github_id(self, github_id: int | str) -> dict[str, Any] | None:
        gid = str(github_id)
        for user in self.users.values():
            if user.get("github_id") == gid:
                return deepcopy(user)
        return None

    async def create_user(
        self,
        email: str,
        password_hash: str | None = None,
        github_id: int | str | None = None,
        name: str | None = None,
    ) -> dict[str, Any]:
        clean = email.strip().casefold()
        if await self.get_user_by_email(clean):
            raise DuplicateUserError("An account with that email already exists.")
        if github_id and await self.get_user_by_github_id(github_id):
            raise DuplicateUserError("An account with that GitHub identity already exists.")

        user_id = str(uuid.uuid4())
        record: dict[str, Any] = {
            "id": user_id,
            "email": clean,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if password_hash is not None:
            record["password_hash"] = password_hash
        if github_id is not None:
            record["github_id"] = str(github_id)
        if name is not None:
            record["name"] = name

        self.users[user_id] = deepcopy(record)
        return record

    async def get_user_data(self, user_id: str) -> dict[str, Any] | None:
        record = self.user_data.get(str(user_id))
        return deepcopy(record) if record else None

    async def save_user_data(
        self,
        user_id: str,
        data_json: str,
        schema_version: int = 1,
    ) -> None:
        self.user_data[str(user_id)] = {
            "user_id": str(user_id),
            "data_json": data_json,
            "schema_version": schema_version,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    async def delete_user_data(self, user_id: str) -> None:
        self.user_data.pop(str(user_id), None)

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        pass


def create_database(settings: Settings) -> DatabaseInterface:
    if settings.has_supabase:
        logger.info("Initializing Supabase database with URL: %s", settings.supabase_url)
        return SupabaseDatabase(settings.supabase_url, settings.supabase_key)

    if settings.production:
        logger.warning(
            "SUPABASE_URL and SUPABASE_KEY are not configured in production. "
            "Falling back to in-memory database to allow service startup. "
            "Please configure SUPABASE_URL and SUPABASE_KEY in your cloud dashboard."
        )
        return MemoryDatabase()

    logger.warning("SUPABASE_URL not configured; falling back to in-memory database for development.")
    return MemoryDatabase()
