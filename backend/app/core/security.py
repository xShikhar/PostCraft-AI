import os
import sys
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError

# JWT secret — REQUIRED. Fail closed if not set. Never use a hardcoded fallback
# in production: a leaked fallback lets anyone forge tokens for any user.
_secret_key_env = os.getenv("JWT_SECRET_KEY")
if not _secret_key_env:
    print(
        "FATAL: JWT_SECRET_KEY is not set. "
        "Generate one with `openssl rand -hex 32` and add it to backend/.env.",
        file=sys.stderr,
    )
    sys.exit(1)
if len(_secret_key_env) < 32:
    print(
        "FATAL: JWT_SECRET_KEY is too short (must be at least 32 chars). "
        "Generate one with `openssl rand -hex 32`.",
        file=sys.stderr,
    )
    sys.exit(1)

SECRET_KEY: str = _secret_key_env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
