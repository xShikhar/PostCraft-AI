import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi.testclient import TestClient
from typing import AsyncGenerator

from app.database import Base, get_db
from app.main import app
import os

# Set environment variables for tests to avoid "API Key missing" short circuits
os.environ["GEMINI_API_KEY"] = "mock_gemini_key"
os.environ["TAVILY_API_KEY"] = "mock_tavily_key"
os.environ["BRAVE_SEARCH_API_KEY"] = "mock_brave_key"

from app.config import get_settings
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
