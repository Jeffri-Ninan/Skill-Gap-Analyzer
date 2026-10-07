from __future__ import annotations

import re

from pwdlib import PasswordHash

PASSWORD_HASHER = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    normalized = email.strip().casefold()
    if len(normalized) > 254 or not EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must contain at least 8 characters.")
    if len(password) > 128:
        raise ValueError("Password must be 128 characters or fewer.")
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return PASSWORD_HASHER.verify(password, password_hash)
