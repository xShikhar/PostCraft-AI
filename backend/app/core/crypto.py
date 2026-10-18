"""Authenticated encryption; corrupt ciphertext never becomes plaintext."""
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import get_settings

@lru_cache
def _get_fernet() -> Fernet:
    try:
        return Fernet(get_settings().RESUME_ENCRYPTION_KEY.encode("ascii"))
    except (ValueError, TypeError, UnicodeError):
        raise ValueError("RESUME_ENCRYPTION_KEY must be a valid Fernet key") from None

def encrypt(plaintext: str | None) -> str | None:
    if not plaintext:
        return plaintext
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")

def decrypt(token: str | None) -> str | None:
    if not token:
        return token
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeError):
        raise ValueError("Encrypted data could not be authenticated") from None

def read_private(value: str | None) -> str:
    return decrypt(value) or ""
