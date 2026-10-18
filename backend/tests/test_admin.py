import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AdminAuditLog, Generation, Project, User
from app.cli.make_admin import toggle_admin


@pytest.mark.asyncio
async def test_admin_endpoints_unauthenticated(client: TestClient):
    random_id = uuid.uuid4()
    for endpoint in ["/api/admin/stats", "/api/admin/users", f"/api/admin/users/{random_id}/generations"]:
        res = client.get(endpoint)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_endpoints_non_admin_forbidden(client: TestClient):
    # 1. Signup regular user
    username = f"regular_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/auth/signup", json={"username": username, "password": "password123", "terms_version": "2026-10-15", "agreed_to_terms": True})
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    random_id = uuid.uuid4()
    for endpoint in ["/api/admin/stats", "/api/admin/users", f"/api/admin/users/{random_id}/generations"]:
        res = client.get(endpoint, headers=headers)
        assert res.status_code == 403
        assert res.json()["detail"] == "Admin access required."


@pytest.mark.asyncio
async def test_admin_stats_and_users(client: TestClient, db_session: AsyncSession):
    # 1. Create admin user
    admin_name = f"admin_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/auth/signup", json={"username": admin_name, "password": "password123", "terms_version": "2026-10-15", "agreed_to_terms": True})
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Elevate user to admin in DB
    user_stmt = select(User).where(User.username == admin_name)
    user_res = await db_session.execute(user_stmt)
    admin_user = user_res.scalars().first()
    admin_user.is_admin = True
    await db_session.commit()

    # 2. Query /api/admin/stats
    stats_res = client.get("/api/admin/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "users" in stats
    assert "generations" in stats
    assert stats["users"]["total"] >= 1
    assert "platform_breakdown" in stats["generations"]

    # 3. Query /api/admin/users
    users_res = client.get("/api/admin/users", headers=headers)
    assert users_res.status_code == 200
    users_data = users_res.json()
    assert "items" in users_data
    assert users_data["total"] >= 1

    # Verify no password hash is exposed
    for item in users_data["items"]:
        assert "password_hash" not in item
        assert "password" not in item
        assert "profile_context" not in item

    # 4. Search user by username
    search_res = client.get(f"/api/admin/users?q={admin_name[:5]}", headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert any(u["username"] == admin_name for u in search_data["items"])


@pytest.mark.asyncio
async def test_admin_user_generations_and_audit_log(client: TestClient, db_session: AsyncSession):
    # 1. Create admin user
    admin_name = f"admin_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/auth/signup", json={"username": admin_name, "password": "password123", "terms_version": "2026-10-15", "agreed_to_terms": True})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    user_stmt = select(User).where(User.username == admin_name)
    user_res = await db_session.execute(user_stmt)
    admin_user = user_res.scalars().first()
    admin_user.is_admin = True
    await db_session.commit()

    # 2. Create target user with a generation
    target_name = f"target_{uuid.uuid4().hex[:6]}"
    t_res = client.post("/api/auth/signup", json={"username": target_name, "password": "password123", "terms_version": "2026-10-15", "agreed_to_terms": True})
    t_token = t_res.json()["access_token"]

    t_user_stmt = select(User).where(User.username == target_name)
    t_user_res = await db_session.execute(t_user_stmt)
    target_user = t_user_res.scalars().first()

    # Create project & generation for target
    project = Project(user_id=target_user.id, name="LinkedIn Project", platform="linkedin")
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)

    gen = Generation(
        project_id=project.id,
        topic="AI Growth",
        raw_thoughts="Thoughts on AI",
        draft_1="Draft 1 content",
        status="finalized",
    )
    db_session.add(gen)
    await db_session.commit()

    # 3. Admin calls /api/admin/users/{user_id}/generations
    gen_res = client.get(f"/api/admin/users/{target_user.id}/generations", headers=headers)
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["total"] == 1
    assert gen_data["items"][0]["topic"] == "AI Growth"
    assert gen_data["user"]["username"] == target_name

    # 4. Assert audit log was recorded
    audit_stmt = select(AdminAuditLog).where(
        AdminAuditLog.admin_user_id == admin_user.id,
        AdminAuditLog.target_user_id == target_user.id,
        AdminAuditLog.action == "viewed_user_generations",
    )
    audit_res = await db_session.execute(audit_stmt)
    audit_entry = audit_res.scalars().first()
    assert audit_entry is not None


@pytest.mark.asyncio
async def test_env_cannot_promote_admin(client, monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAMES", "bootstrap")
    res = client.post("/api/auth/signup", json={"username": "bootstrap", "password": "password123", "terms_version": "2026-10-15", "agreed_to_terms": True})
    headers = {"Authorization": "Bearer " + res.json()["access_token"]}
    assert client.get("/api/admin/stats", headers=headers).status_code == 403
    assert client.get("/api/users/me", headers=headers).json()["is_admin"] is False
