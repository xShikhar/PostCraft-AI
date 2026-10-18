from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# ─── Module-level engine singleton ─────────────────────
# Creating an engine per request leaks connection pools and dramatically
# slows down under load. We build ONE engine at module import and reuse it.

_settings = get_settings()
from sqlalchemy.engine import make_url
_database_url = make_url(_settings.DATABASE_URL)
_query = dict(_database_url.query)
_ssl_mode = _query.pop("sslmode", None)
_database_url = _database_url.set(query=_query)
_connect_args = {}
if (_settings.DATABASE_SSL or _ssl_mode in ("require", "verify-ca", "verify-full")) and _settings.DATABASE_URL.startswith("postgresql"):
    import ssl
    _connect_args["ssl"] = ssl.create_default_context()
_engine = create_async_engine(
    _database_url,
    echo=_settings.DEBUG and _settings.ENVIRONMENT == "development",
    connect_args=_connect_args,
    pool_pre_ping=True,
    # pool_size and max_overflow default to 5 and 10 respectively which is
    # fine for most workloads. Bump if you see connection pool exhaustion.
)
_session_maker = async_sessionmaker(
    bind=_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async database session."""
    async with _session_maker() as session:
        yield session
