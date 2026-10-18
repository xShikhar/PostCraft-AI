import pytest
from sqlalchemy import select
from app.models import User, Project, Generation, ChatHistory, Preference, StyleProfile

@pytest.mark.asyncio
async def test_editor_finalization_preserves_history_and_learns(client, db_session):
    token = client.post("/api/auth/signup", json={"username": "writer", "password": "password123", "terms_version": "2026-10-15", "agreed_to_terms": True}).json()["access_token"]
    headers = {"Authorization": "Bearer " + token}
    user = (await db_session.execute(select(User))).scalars().first()
    project = Project(user_id=user.id, name="Writing", platform="linkedin")
    db_session.add(project)
    await db_session.flush()
    generation = Generation(project_id=project.id, topic="Async work", raw_thoughts="Decision ownership matters", draft_1="Explicit owners make decisions actionable. DM me for the template.", status="editing")
    db_session.add(generation)
    await db_session.commit()
    url = f"/api/generations/{generation.id}"
    edited = client.post(url + "/edit", headers=headers, json={"instruction": "Tighten the argument", "draft_index": 1})
    assert edited.status_code == 200, edited.text
    finalized = client.post(url + "/finalize", headers=headers, json={"final_draft_index": 1})
    assert finalized.status_code == 200, finalized.text
    assert len(client.get(url + "/full", headers=headers).json()["chat_history"]) == 2
    assert len((await db_session.execute(select(Preference))).scalars().all()) == 1
    assert len((await db_session.execute(select(StyleProfile))).scalars().all()) == 1
    assert client.post(url + "/finalize", headers=headers, json={"final_draft_index": 1}).status_code == 200
    assert client.post(url + "/finalize", headers=headers, json={"final_draft_index": 2}).status_code == 409
    assert client.post(url + "/edit", headers=headers, json={"instruction": "Change again"}).status_code == 400
