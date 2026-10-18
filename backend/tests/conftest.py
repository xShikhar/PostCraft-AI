import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi.testclient import TestClient
from typing import AsyncGenerator

import os
# Set environment variables for tests before importing app modules
os.environ.__setitem__("GEMINI_API_KEY", "mock_gemini_key")
os.environ.__setitem__("TAVILY_API_KEY", "mock_tavily_key")
os.environ.__setitem__("SERP_API_KEY", "mock_serp_key")
os.environ.__setitem__("JWT_SECRET_KEY", "mock_jwt_secret_key_at_least_32_chars_long_for_testing")
os.environ.__setitem__("RESUME_ENCRYPTION_KEY", "GqqEbSX3AX9Y4cKboWBIVmMjW_96ek-JjsUIi7lY_Xg=")

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ENVIRONMENT"] = "test"
os.environ["CHROMA_HOST"] = "localhost"
os.environ["DATABASE_SSL"] = "False"
os.environ["DEBUG"] = "False"
os.environ["SENTRY_DSN"] = ""
os.environ["RATE_LIMIT_STORAGE_URI"] = "memory://"

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
    from app.services.pipeline.background_tasks import wait_background_tasks

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    with mock.patch("app.core.database._session_maker", TestingSessionLocal), \
         mock.patch("app.services.pipeline.background_tasks._session_maker", TestingSessionLocal), \
         mock.patch("app.services.deletion._session_maker", TestingSessionLocal):
        async with TestingSessionLocal() as session:
            yield session
        await wait_background_tasks(timeout=2.0)
        
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

@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    from unittest.mock import MagicMock, AsyncMock
    def create_fake(**kwargs):
        client = MagicMock()
        def structured(schema, include_raw=False):
            fields = schema.model_fields
            if "structure" in fields:
                data = {k: "Direct, concrete practitioner writing" for k in fields}
            elif "passed" in fields:
                data = {"passed": True, "substance_score": 8}
            elif "revised_draft" in fields:
                data = {"revised_draft": "Give async decisions an owner and a deadline. Without either, a document is just an inbox. DM me for the decision template.", "reply": "Tightened the argument and kept the practical next step."}
            elif "role" in fields:
                data = {"role": "Engineer", "industry": "Software", "expertise_areas": ["Python"], "experience_level": "senior"}
            else:
                data = {k: "Async work needs an explicit decision owner. Put the deadline beside the question so reviewers can act. DM me for the review template." for k in fields}
            parsed = schema(**data)
            raw = MagicMock(usage_metadata={"input_tokens": 30, "output_tokens": 20})
            return MagicMock(ainvoke=AsyncMock(return_value={"parsed": parsed, "raw": raw} if include_raw else parsed))
        client.with_structured_output = structured
        client.ainvoke = AsyncMock(return_value=MagicMock(content="Hook > explanation > CTA", usage_metadata={}))
        return client
    monkeypatch.setattr("app.services.pipeline.llm_utils.create_gemini_client", create_fake)
    monkeypatch.setattr("app.services.pipeline.pipeline.create_gemini_client", create_fake)
    monkeypatch.setattr("app.services.research._search_tavily", AsyncMock(return_value=(["Public discussion about decision ownership."], [])))
    monkeypatch.setattr("app.services.research._search_serp_api", AsyncMock(return_value=([], [])))
    # Block HTTP providers without touching Windows event-loop sockets.
    import httpx
    async def deny_network(*args, **kwargs):
        raise AssertionError("External HTTP is disabled in tests")
    monkeypatch.setattr(httpx.AsyncClient, "request", deny_network)
