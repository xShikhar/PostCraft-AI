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
_engine = create_async_engine(
    _settings.DATABASE_URL,
    echo=_settings.DEBUG,
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
