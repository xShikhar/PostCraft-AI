from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import ChatHistory, CostLog, Generation, Project, User
from tests.test_remediation import signup


async def seeded(client, session, status="editing", username="lifecycle"):
    headers = signup(client, username)
    user = (await session.execute(select(User).where(User.username == username))).scalar_one()
    project = Project(user_id=user.id, name="Draft lifecycle", platform="linkedin")
    session.add(project)
    await session.flush()
    generation = Generation(project_id=project.id, topic="Ownership", raw_thoughts="Author notes", draft_1="Original one", draft_2="Original two", draft_3="Original three", status=status, original_drafts={"draft_1": "Original one"}, quality_data={"result": "PASS", "substance_score": 8})
    session.add(generation)
    await session.commit()
    return headers, generation


@pytest.mark.asyncio
async def test_manual_save_persists_exact_text_invalidates_quality_and_rejects_stale(client, db_session):
    headers, generation = await seeded(client, db_session)
    url = f"/api/generations/{generation.id}"
    version = client.get(url + "/full", headers=headers).json()["updated_at"]
    payload = {"draft_index": 2, "content": "  My own\nwords.  ", "expected_updated_at": version}
    response = client.patch(url, headers=headers, json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["content"] == "  My own\nwords.  "
    assert data["draft_index"] == 2
    assert data["status"] == "needs_review"
    assert data["updated_at"] != version
    reloaded = client.get(url + "/full", headers=headers).json()
    assert reloaded["draft_2"] == payload["content"]
    assert reloaded["draft_1"] == "Original one"
    assert reloaded["quality"] is None
    assert reloaded["original_drafts"] == {"draft_1": "Original one"}
    assert client.patch(url, headers=headers, json={**payload, "content": "Stale overwrite"}).status_code == 409
    assert client.get(url + "/full", headers=headers).json()["draft_2"] == payload["content"]


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["finalized", "generating"])
async def test_save_respects_lifecycle_lock(client, db_session, status):
    headers, generation = await seeded(client, db_session, status)
    response = client.patch(f"/api/generations/{generation.id}", headers=headers, json={"draft_index": 1, "content": "New", "expected_updated_at": generation.updated_at.isoformat()})
    assert response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("change", [{"content": ""}, {"content": " \n "}, {"content": "x" * 20001}, {"draft_index": 0}, {"draft_index": 4}, {"expected_updated_at": "not-a-date"}, {"expected_updated_at": None}])
async def test_save_rejects_invalid_input(client, db_session, change):
    headers, generation = await seeded(client, db_session)
    payload = {"draft_index": 1, "content": "New", "expected_updated_at": generation.updated_at.isoformat()}
    assert client.patch(f"/api/generations/{generation.id}", headers=headers, json={**payload, **change}).status_code == 422


@pytest.mark.asyncio
async def test_mutations_hide_other_accounts_and_require_auth(client, db_session):
    owner, generation = await seeded(client, db_session)
    stranger = signup(client, "stranger")
    url = f"/api/generations/{generation.id}"
    payload = {"draft_index": 1, "content": "New", "expected_updated_at": generation.updated_at.isoformat()}
    for headers, expected in [(stranger, 404), ({}, 401)]:
        assert client.patch(url, headers=headers, json=payload).status_code == expected
        assert client.delete(url, headers=headers).status_code == expected
    assert client.get(url + "/full", headers=stranger).status_code == 404
    assert client.get(url + "/full", headers=owner).status_code == 200


@pytest.mark.asyncio
async def test_delete_cleans_chat_and_costs_preserves_project(client, db_session):
    headers, generation = await seeded(client, db_session, "finalized")
    db_session.add_all([ChatHistory(generation_id=generation.id, role="user", content="Private notes"), CostLog(generation_id=generation.id, operation="generate")])
    await db_session.commit()
    response = client.delete(f"/api/generations/{generation.id}", headers=headers)
    assert response.status_code == 204, response.text
    assert not response.content
    assert client.get(f"/api/generations/{generation.id}/full", headers=headers).status_code == 404
    for model in (ChatHistory, CostLog):
        assert (await db_session.execute(select(func.count()).select_from(model))).scalar_one() == 0
    assert (await db_session.execute(select(func.count()).select_from(Project))).scalar_one() == 1


@pytest.mark.asyncio
async def test_delete_rejects_generating(client, db_session):
    headers, generation = await seeded(client, db_session, "generating")
    assert client.delete(f"/api/generations/{generation.id}", headers=headers).status_code == 409


@pytest.mark.asyncio
async def test_status_sort_apply_before_pagination_and_validate(client, db_session):
    headers, generation = await seeded(client, db_session)
    generation.created_at = datetime.now(timezone.utc) - timedelta(days=2)
    db_session.add_all([Generation(project_id=generation.project_id, topic="New draft", raw_thoughts="Notes", status="editing"), Generation(project_id=generation.project_id, topic="Final", raw_thoughts="Notes", status="finalized")])
    await db_session.commit()
    response = client.get("/api/generations?status=editing&sort=oldest&limit=1", headers=headers)
    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert response.json()["items"][0]["topic"] == "Ownership"
    assert client.get("/api/generations?status=editing&sort=newest&limit=1", headers=headers).json()["items"][0]["topic"] == "New draft"
    for query in ("status=unknown", "sort=unsafe"):
        assert client.get("/api/generations?" + query, headers=headers).status_code == 422


@pytest.mark.asyncio
async def test_full_evidence_preserves_missing_metadata(client, db_session):
    headers, generation = await seeded(client, db_session)
    url = f"/api/generations/{generation.id}/full"
    data = client.get(url, headers=headers).json()
    assert data["research_source"] is None
    assert data["research_confidence"] is None
    assert data["research_retrieved_at"] is None
    assert data["sources"] == []
    generation.research_data = {"source": "general_search", "confidence": "medium", "retrieved_at": "2026-10-18T09:00:00Z", "sources": [{"title": "Source", "url": "https://example.com", "snippet": "Evidence"}]}
    await db_session.commit()
    data = client.get(url, headers=headers).json()
    assert data["research_source"] == "general_search"
    assert data["research_confidence"] == "medium"
    assert data["research_retrieved_at"] == "2026-10-18T09:00:00Z"

@pytest.mark.asyncio
async def test_initial_generation_quality_applies_to_all_generated_drafts(client, db_session):
    headers = signup(client, "scope-generation")
    response = client.post("/api/generations", headers=headers, json={"topic": "Decision ownership", "platform": "linkedin", "raw_thoughts": "Async decisions need a named owner and a review deadline.", "use_context": False})
    assert response.status_code == 200, response.text
    generation_id = response.json()["generation_id"]
    full = client.get(f"/api/generations/{generation_id}/full", headers=headers).json()
    assert full["quality"]["scope"] == "generation"
    assert full["quality"]["result"] == "PASS"
    assert "draft_index" not in full["quality"]


@pytest.mark.asyncio
@pytest.mark.parametrize("operation,index", [("edit", 2), ("finalize", 3)])
async def test_edit_and_finalize_quality_only_apply_to_evaluated_variation(client, db_session, operation, index):
    headers, generation = await seeded(client, db_session)
    good = "Async decisions need named owners. A review deadline turns a quiet document into an actionable request. DM me for the decision template."
    generation.draft_1 = generation.draft_2 = generation.draft_3 = good
    await db_session.commit()
    url = f"/api/generations/{generation.id}"
    payload = {"draft_index": index, "instruction": "Tighten the practical explanation"} if operation == "edit" else {"final_draft_index": index}
    response = client.post(url + "/" + operation, headers=headers, json=payload)
    assert response.status_code == 200, response.text
    full = client.get(url + "/full", headers=headers).json()
    assert full["quality"]["scope"] == "draft"
    assert full["quality"]["draft_index"] == index
    assert full["quality"]["result"] == "PASS"
    assert full["draft_1"] == good
