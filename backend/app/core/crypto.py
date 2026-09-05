"""
Application-level encryption for PII at rest.

Uses Fernet (AES-128 in CBC mode + HMAC-SHA256) from the `cryptography` package.
The key is loaded from the `RESUME_ENCRYPTION_KEY` env var, which must be a
32-byte url-safe base64-encoded key.

Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Add to backend/.env:
    RESUME_ENCRYPTION_KEY=<generated-key>

If the env var is missing or malformed, encryption/decryption raises — the
app fails closed rather than silently writing plaintext to disk.
"""

import os
import sys

from cryptography.fernet import Fernet, InvalidToken


_fernet: Fernet | None = None
_key_str: str | None = None


def _get_fernet() -> Fernet:
    """Load the Fernet instance from the env var, fail-closed on missing key."""
    global _fernet, _key_str
    if _fernet is not None:
        return _fernet

    _key_str = os.getenv("RESUME_ENCRYPTION_KEY")
    if not _key_str:
        print(
            "FATAL: RESUME_ENCRYPTION_KEY is not set. "
            "Generate one with `python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` and add it to backend/.env.",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        _fernet = Fernet(_key_str.encode("ascii"))
    except (ValueError, TypeError) as e:
        print(
            f"FATAL: RESUME_ENCRYPTION_KEY is malformed: {e}. "
            "Expected a 32-byte url-safe base64-encoded key.",
            file=sys.stderr,
        )
        sys.exit(1)

    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a UTF-8 string. Returns a url-safe base64 token (str)."""
    if plaintext is None:
        return None  # type: ignore
    if plaintext == "":
        return ""
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("ascii")


def decrypt(token: str) -> str:
    """Decrypt a Fernet token. Returns the original UTF-8 string.

    Falls back to returning the token as-is for backwards compatibility with
    existing unencrypted data stored before encryption was enabled.

    Fail-closed: raises SystemExit if the encryption key is missing or
    malformed — we must not silently swallow key-not-set via a broad
    Exception catch that would hide the crash.
    """
    if token is None:
        return None  # type: ignore
    if token == "":
        return ""

    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        # Backwards compat: data stored before encryption was enabled.
        # Fernet tokens are ASCII and start with "gAAAAA"; anything else is plaintext.
        return token
    except SystemExit:
        # Re-raise so the process exits rather than silently returning plaintext.
        raise
