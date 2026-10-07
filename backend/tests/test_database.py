from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from postgrest.exceptions import APIError

from backend.database import (
    DatabaseError,
    DuplicateUserError,
    MemoryDatabase,
    SupabaseDatabase,
)


class DatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_memory_database_crud(self) -> None:
        db = MemoryDatabase()
        user = await db.create_user("test@example.com", password_hash="hashed_pw", name="Tester")
        self.assertEqual(user["email"], "test@example.com")
        self.assertEqual(user["name"], "Tester")

        fetched = await db.get_user_by_email("test@example.com")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], user["id"])

        by_id = await db.get_user_by_id(user["id"])
        self.assertEqual(by_id["email"], "test@example.com")

        # Duplicate email raises error
        with self.assertRaises(DuplicateUserError):
            await db.create_user("test@example.com", password_hash="hash2")

        # User data operations
        data = await db.get_user_data(user["id"])
        self.assertIsNone(data)

        await db.save_user_data(user["id"], '{"profile":[]}', schema_version=1)
        saved = await db.get_user_data(user["id"])
        self.assertIsNotNone(saved)
        self.assertEqual(saved["data_json"], '{"profile":[]}')

        await db.delete_user_data(user["id"])
        self.assertIsNone(await db.get_user_data(user["id"]))

    async def test_supabase_database_mocked(self) -> None:
        db = SupabaseDatabase("https://xyz.supabase.co", "fake-key")
        mock_client = MagicMock()
        db.client = mock_client

        # Mock table().select().eq().limit().execute()
        table_mock = MagicMock()
        mock_client.table.return_value = table_mock

        select_mock = MagicMock()
        table_mock.select.return_value = select_mock
        eq_mock = MagicMock()
        select_mock.eq.return_value = eq_mock
        limit_mock = MagicMock()
        eq_mock.limit.return_value = limit_mock
        limit_mock.execute = MagicMock(return_value=MagicMock(data=[{"id": "u-1", "email": "test@example.com"}]))

        user = await db.get_user_by_email("test@example.com")
        self.assertIsNotNone(user)
        self.assertEqual(user["id"], "u-1")

        # Mock insert duplicate error
        table_mock.insert.return_value.execute = MagicMock(
            side_effect=APIError({"code": "23505", "message": "duplicate key value violates unique constraint", "details": "Key (email)=(test@example.com) already exists."})
        )
        with self.assertRaises(DuplicateUserError):
            await db.create_user("test@example.com")


if __name__ == "__main__":
    unittest.main()
