import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from sqlalchemy import select, func
from app.models import User, Project, Generation, Preference, StyleProfile, VectorDeletionJob, CostLog
from app.core.crypto import encrypt, decrypt
from app.services.pipeline.state import GeneratedDrafts, ExtractedPattern, QualityVerdict
from app.services.pipeline.deps import PipelineDeps
from app.services.pipeline.nodes import node_quality_check, node_draft_generation, _build_temporal_style_bias
from app.core.config import Settings

GOOD = "Async decisions need named owners. A review deadline turns a quiet document into an actionable request. DM me for the decision template."

def signup(client, username="writer"):
    result = client.post("/api/auth/signup", json={"username": username, "password": "password123", "agreed_to_terms": True, "terms_version": "2026-10-15"})
    assert result.status_code == 200, result.text
    return {"Authorization": "Bearer " + result.json()["access_token"]}

@pytest.mark.asyncio
async def test_consent_and_case_insensitive_identity(client):
    assert client.post("/api/auth/signup", json={"username": "writer", "password": "password123"}).status_code == 422
    signup(client, "Writer")
    assert client.post("/api/auth/signup", json={"username": "WRITER", "password": "password123", "agreed_to_terms": True, "terms_version": "2026-10-15"}).status_code == 400
    assert client.post("/api/auth/login", data={"username": "WRITER", "password": "password123"}).status_code == 200

@pytest.mark.asyncio
async def test_profile_fields_are_independently_encrypted(client, db_session):
    headers = signup(client)
    assert client.patch("/api/users/me", headers=headers, json={"about_me": "Engineer", "profile_context": "Infrastructure", "writing_style": "Direct"}).status_code == 200
    client.patch("/api/users/me", headers=headers, json={"profile_context": "New background"})
    user = (await db_session.execute(select(User))).scalars().first()
    await db_session.refresh(user)
    assert user.about_me.startswith("gAAAAA")
    assert decrypt(user.writing_style) == "Direct"
    assert client.get("/api/users/me", headers=headers).json()["writing_style"] == "Direct"
    client.patch("/api/users/me", headers=headers, json={"about_me": None})
    assert client.get("/api/users/me", headers=headers).json()["about_me"] == ""

def test_corrupt_ciphertext_is_rejected():
    token = encrypt("private data")
    with pytest.raises(ValueError):
        decrypt(token[:-8] + "xxxxxxxx")
    with pytest.raises(ValueError):
        decrypt("legacy plaintext")

@pytest.mark.asyncio
async def test_judge_error_resets_failure_state(db_session):
    llm = MagicMock()
    llm.with_structured_output.return_value.ainvoke = AsyncMock(side_effect=RuntimeError("Unavailable"))
    deps = PipelineDeps(session=db_session, llm=llm, settings=Settings())
    result = await node_quality_check({"user_id": str(uuid.uuid4()), "generation_id": str(uuid.uuid4()), "use_context": False, "drafts": GeneratedDrafts(draft_1=GOOD, draft_2=GOOD, draft_3=GOOD), "is_hard_failure": True, "failed_draft_indices": [1], "substance_score": 9}, deps)
    assert result["quality_results"].startswith("FAIL")
    assert result["is_hard_failure"] is False
    assert result["failed_draft_indices"] == []
    assert result["substance_score"] is None

@pytest.mark.asyncio
async def test_all_banned_drafts_are_targeted(db_session):
    deps = PipelineDeps(session=db_session, llm=None, settings=Settings())
    result = await node_quality_check({"user_id": str(uuid.uuid4()), "use_context": False, "drafts": GeneratedDrafts(draft_1="Delve into growth", draft_2=GOOD, draft_3="A testament to effort")}, deps)
    assert result["is_hard_failure"] is True
    assert result["failed_draft_indices"] == [0, 2]

@pytest.mark.asyncio
async def test_score_alone_requires_review(db_session):
    llm = MagicMock()
    llm.with_structured_output.return_value.ainvoke = AsyncMock(return_value={"parsed": QualityVerdict(passed=True, substance_score=6), "raw": None})
    deps = PipelineDeps(session=db_session, llm=llm, settings=Settings())
    result = await node_quality_check({"user_id": str(uuid.uuid4()), "generation_id": str(uuid.uuid4()), "use_context": False, "drafts": GeneratedDrafts(draft_1=GOOD, draft_2=GOOD, draft_3=GOOD)}, deps)
    assert result["quality_results"].startswith("FAIL")
    assert result["is_hard_failure"] is False

@pytest.mark.asyncio
async def test_retry_schema_only_requests_failed_draft_and_reads_preferences(db_session):
    user = User(username="learner", password_hash="hash", about_me=encrypt("Secret career"))
    db_session.add(user)
    await db_session.flush()
    db_session.add(Preference(user_id=user.id, platform="linkedin", preference_text=encrypt("Prefer concrete mechanisms")))
    await db_session.commit()
    seen = {}
    llm = MagicMock()
    def structured(schema, include_raw=False):
        seen["fields"] = set(schema.model_fields)
        async def invoke(prompt):
            seen["prompt"] = prompt
            return {"parsed": schema(draft_2="Rewritten explanation. DM me for the template."), "raw": None}
        return MagicMock(ainvoke=invoke)
    llm.with_structured_output = structured
    state = {"user_id": str(user.id), "platform": "linkedin", "topic": "Async work", "raw_thoughts": "Named owners", "use_context": False, "writing_style": "Use concise sentences", "research_result": None, "extracted_pattern": ExtractedPattern(**{field: "Specific" for field in ExtractedPattern.model_fields}), "retry_count": 1, "failed_draft_indices": [1], "quality_feedback": "Rewrite the second draft", "drafts": GeneratedDrafts(draft_1=GOOD, draft_2="old", draft_3=GOOD)}
    result = await node_draft_generation(state, PipelineDeps(session=db_session, llm=llm, settings=Settings()))
    assert seen["fields"] == {"draft_2"}
    assert "Prefer concrete mechanisms" in seen["prompt"]
    assert "Use concise sentences" in seen["prompt"]
    assert "Secret career" not in seen["prompt"]
    assert result["drafts"].draft_1 == GOOD

@pytest.mark.asyncio
async def test_postgres_style_fallback_uses_timestamp(db_session, monkeypatch):
    user = User(username="recency", password_hash="hash")
    db_session.add(user)
    await db_session.flush()
    now = datetime.now(timezone.utc)
    db_session.add_all([StyleProfile(id=uuid.UUID(int=1), user_id=user.id, platform="x", tone="new voice", created_at=now), StyleProfile(id=uuid.UUID(int=(1 << 128)-1), user_id=user.id, platform="x", tone="old voice", created_at=now-timedelta(days=1))])
    await db_session.commit()
    monkeypatch.setattr("app.services.pipeline.nodes.vector_service.get_recent_profiles", MagicMock(side_effect=RuntimeError("Offline")))
    result = await _build_temporal_style_bias(PipelineDeps(session=db_session, llm=None, settings=Settings()), str(user.id), "x")
    assert result.index("new voice") < result.index("old voice")

@pytest.mark.asyncio
async def test_capacity_timeout_does_not_create_generation(client, db_session, monkeypatch):
    headers = signup(client)
    sem = MagicMock(acquire=AsyncMock(side_effect=TimeoutError))
    monkeypatch.setattr("app.api.generations.GENERATION_CONCURRENCY_SEMAPHORE", sem)
    result = client.post("/api/generations", headers=headers, json={"topic": "Ownership", "platform": "linkedin", "raw_thoughts": "Explicit owners"})
    assert result.status_code == 429
    assert result.headers["retry-after"] == "10"
    assert (await db_session.execute(select(func.count(Generation.id)))).scalar() == 0

@pytest.mark.asyncio
async def test_failure_contract_is_explicit(client, monkeypatch):
    headers = signup(client)
    async def failed(self, state):
        state.error = "Generation unavailable"
        return state
    monkeypatch.setattr("app.api.generations.PostGenerationPipeline.run", failed)
    response = client.post("/api/generations", headers=headers, json={"topic": "Ownership", "platform": "linkedin", "raw_thoughts": "Explicit owners"})
    assert response.json()["status"] == "failed"
    assert response.json()["error"] == "Generation unavailable"

@pytest.mark.asyncio
async def test_deletion_failure_has_durable_erasure_job(client, db_session, monkeypatch):
    headers = signup(client)
    user = (await db_session.execute(select(User))).scalars().first()
    user_id = user.id
    monkeypatch.setattr("app.services.deletion.vector_service.delete_all_for_user", MagicMock(side_effect=RuntimeError("Offline")))
    response = client.delete("/api/users/me", headers=headers)
    assert response.status_code == 202
    assert response.json()["status"] == "deletion_pending"
    assert await db_session.get(VectorDeletionJob, user_id) is not None
    assert client.get("/api/users/me", headers=headers).status_code == 401
    assert (await db_session.execute(select(func.count(User.id)))).scalar() == 0

@pytest.mark.asyncio
async def test_rate_limit_headers_and_user_keys(client):
    from app.api.auth import auth_limiter, rate_limit_key
    from starlette.requests import Request
    first = signup(client, "one")
    second = signup(client, "two")
    def req(headers, path):
        return Request({"type": "http", "path": path, "headers": [(b"authorization", headers["Authorization"].encode())], "client": ("127.0.0.1", 1)})
    assert rate_limit_key(req(first, "/api/generations")) != rate_limit_key(req(second, "/api/generations"))
    auth_limiter.enabled = True
    auth_limiter.reset()
    try:
        response = client.post("/api/auth/login", data={"username": "one", "password": "password123"})
        assert response.status_code == 200
        assert "x-ratelimit-limit" in response.headers
        for _ in range(5):
            response = client.post("/api/auth/login", data={"username": "one", "password": "bad"})
        assert response.status_code == 429
        assert "retry-after" in response.headers
    finally:
        auth_limiter.enabled = False
        auth_limiter.reset()

def test_fresh_migration_and_legacy_encryption(tmp_path):
    import os, subprocess, sys, sqlite3
    path = tmp_path / "migration.db"
    env = dict(os.environ, DATABASE_URL="sqlite+aiosqlite:///" + str(path).replace("\\", "/"), DATABASE_SSL="False", PYTHONUTF8="1")
    migrated = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], env=env, capture_output=True, text=True)
    assert migrated.returncode == 0, migrated.stderr
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "a2d4e6f8b0c1"
        connection.execute("INSERT INTO users (id, username, password_hash, profile_context, about_me, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (uuid.uuid4().hex, "legacy", "hash", "Career notes\n---\n[writing_style]\nBe direct", "Engineer", 0, "2026-10-15"))
    encrypted = subprocess.run([sys.executable, "-m", "app.core.migrate_resume_encryption"], env=env, capture_output=True, text=True)
    assert encrypted.returncode == 0, encrypted.stderr
    with sqlite3.connect(path) as connection:
        about, profile, style = connection.execute("SELECT about_me, profile_context, writing_style FROM users").fetchone()
        assert decrypt(about) == "Engineer"
        assert decrypt(profile) == "Career notes"
        assert decrypt(style) == "Be direct"
    repeated = subprocess.run([sys.executable, "-m", "app.core.migrate_resume_encryption"], env=env, capture_output=True, text=True)
    assert repeated.returncode == 0, repeated.stderr

@pytest.mark.asyncio
async def test_upload_rejects_binary_and_oversize_before_analysis(client):
    headers = signup(client)
    assert client.post("/api/users/me/resume", headers=headers, files={"file": ("binary.txt", b"\x00\x01\xffbinary", "text/plain")}).status_code == 400
    assert client.post("/api/users/me/resume", headers=headers, files={"file": ("oversize.txt", b"x" * (5 * 1024 * 1024 + 1), "text/plain")}).status_code == 413

@pytest.mark.asyncio
async def test_real_resume_service_records_owned_cost(client, db_session):
    from app.services.pipeline.background_tasks import wait_background_tasks
    headers = signup(client)
    response = client.post("/api/users/me/resume", headers=headers, files={"file": ("resume.txt", b"Engineer building explicit decision workflows with Python.", "text/plain")})
    assert response.status_code == 200, response.text
    await wait_background_tasks()
    costs = (await db_session.execute(select(CostLog).where(CostLog.operation == "resume_summary"))).scalars().all()
    assert len(costs) == 1
    assert costs[0].user_id is not None
    assert costs[0].model_name

@pytest.mark.asyncio
async def test_bearer_case_does_not_change_budget(client):
    from app.api.auth import rate_limit_key
    from starlette.requests import Request
    header = signup(client)["Authorization"]
    def request(value):
        return Request({"type": "http", "path": "/api/generations", "headers": [(b"authorization", value.encode())], "client": ("127.0.0.1", 1)})
    assert rate_limit_key(request(header)) == rate_limit_key(request(header.replace("Bearer", "bearer")))

def test_chroma_http_is_bounded_without_network(monkeypatch):
    import httpx
    from app.services.chroma_http import bounded_http_client
    requests = []
    def respond(request):
        requests.append(request)
        path = request.url.path
        if path.endswith("/auth/identity"):
            body = {"user_id": "test-user", "tenant": "default_tenant", "databases": ["default_database"]}
        elif "/databases/" in path:
            body = {"id": str(uuid.uuid4()), "name": "default_database", "tenant": "default_tenant"}
        elif "/tenants/" in path:
            body = {"name": "default_tenant"}
        else:
            body = {"nanosecond heartbeat": 1}
        return httpx.Response(200, json=body)
    original = httpx.Client
    def client_factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(respond)
        return original(*args, **kwargs)
    monkeypatch.setattr(httpx, "Client", client_factory)
    client = bounded_http_client("fixture-" + uuid.uuid4().hex + ".invalid", 8000)
    assert client.heartbeat() == 1
    assert requests
    assert all(request.extensions["timeout"]["read"] == 10 for request in requests)
    client._system.stop()

@pytest.mark.asyncio
async def test_restart_reconciles_abandoned_generation(db_session):
    from app.services.deletion import retry_erasure_jobs
    user = User(username="interrupted", password_hash="hash")
    db_session.add(user)
    await db_session.flush()
    project = Project(user_id=user.id, platform="linkedin", name="Test")
    db_session.add(project)
    await db_session.flush()
    generation = Generation(project_id=project.id, topic="Interrupted", raw_thoughts="Notes", status="generating", created_at=datetime.now(timezone.utc) - timedelta(minutes=11))
    db_session.add(generation)
    await db_session.commit()
    await retry_erasure_jobs()
    await db_session.refresh(generation)
    assert generation.status == "failed"

def test_invalid_resume_key_fails_startup(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.crypto import _get_fernet
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "RESUME_ENCRYPTION_KEY", "invalid")
    _get_fernet.cache_clear()
    try:
        with pytest.raises(ValueError, match="valid Fernet key"):
            with TestClient(app):
                pass
    finally:
        _get_fernet.cache_clear()

def test_missing_jwt_key_fails_import():
    import os, sys, subprocess
    result = subprocess.run([sys.executable, "-c", "import app.core.security"], env=dict(os.environ, JWT_SECRET_KEY=""), capture_output=True, text=True)
    assert result.returncode == 1
    assert "JWT_SECRET_KEY is not set" in result.stderr

@pytest.mark.asyncio
async def test_revision_facts_ground_final_quality(db_session, monkeypatch):
    from app.api.editor import quality_state
    from app.models import ChatHistory
    user = User(username="facts", password_hash="hash")
    db_session.add(user)
    await db_session.flush()
    project = Project(user_id=user.id, name="Facts", platform="linkedin")
    db_session.add(project)
    await db_session.flush()
    generation = Generation(project_id=project.id, topic="Revenue", raw_thoughts="Write about my business", draft_1=GOOD)
    db_session.add(generation)
    await db_session.flush()
    db_session.add(ChatHistory(generation_id=generation.id, draft_index=1, role="user", content="I reached $5M ARR; include this milestone."))
    await db_session.commit()
    result, _, _ = await quality_state(generation, project, user, "I reached $5M ARR. DM me for the operating template.", db_session)
    assert result["quality_results"] == "PASS"

def test_public_research_does_not_justify_personal_metrics():
    from app.services.pipeline.unsourced_numbers import check_unsourced_numbers
    assert check_unsourced_numbers("I grew to $5M ARR.", [], ["Another founder reached $5M ARR."])[0] is False
    passed, _, warnings = check_unsourced_numbers("Latency is 500ms.", [], ["The measured latency is 500ms."])
    assert passed and not warnings
