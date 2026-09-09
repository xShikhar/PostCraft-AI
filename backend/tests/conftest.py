import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi.testclient import TestClient
from typing import AsyncGenerator

import os
# Set environment variables for tests before importing app modules
os.environ.setdefault("GEMINI_API_KEY", "mock_gemini_key")
os.environ.setdefault("TAVILY_API_KEY", "mock_tavily_key")
os.environ.setdefault("SERP_API_KEY", "mock_serp_key")
os.environ.setdefault("JWT_SECRET_KEY", "mock_jwt_secret_key_at_least_32_chars_long_for_testing")
os.environ.setdefault("RESUME_ENCRYPTION_KEY", "GqqEbSX3AX9Y4cKboWBIVmMjW_96ek-JjsUIi7lY_Xg=")

from app.core.database import Base, get_db
from app.main import app

import unittest.mock as mock

# Globally mock chromadb to prevent downloading the embedding model
patcher = mock.patch("app.services.vector.chromadb")
mock_chromadb = patcher.start()

# Disable rate limiter for test runs
app.state.limiter.enabled = False

from app.core.config import get_settings
get_settings.cache_clear()

# Use an in-memory SQLite DB for tests
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with TestingSessionLocal() as session:
        yield session
        
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
