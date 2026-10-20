import pytest
from unittest.mock import AsyncMock
from tests.test_draft_lifecycle import seeded
from app.api import editor

@pytest.mark.asyncio
@pytest.mark.parametrize("feedback,score", [("FAIL [substance]: Add a concrete example", 5), ("FAIL: Quality evaluation unavailable; manual review required", None)])
async def test_review_then_explicit_finalize(client, db_session, monkeypatch, feedback, score):
    headers, generation = await seeded(client, db_session)
    judge = AsyncMock(return_value={"quality_results": feedback, "substance_score": score, "is_hard_failure": False})
    monkeypatch.setattr(editor, "node_quality_check", judge)
    url = f"/api/generations/{generation.id}"
    review = client.post(url + "/finalize", headers=headers, json={"final_draft_index": 1})
    assert review.status_code == 200, review.text
    data = review.json()
    assert data["status"] == "needs_review"
    assert data["quality"]["substance_score"] == score
    assert data["quality"]["result"] == feedback
    assert client.get(url + "/full", headers=headers).json()["status"] == "needs_review"
    result = client.post(url + "/finalize", headers=headers, json={"final_draft_index": 1, "accept_warnings": True, "review_token": data["quality"]["review_token"]})
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "finalized"
    assert result.json()["quality"]["accepted_warnings"] is True
    assert result.json()["quality"]["result"] == feedback
    assert judge.await_count == 1

@pytest.mark.asyncio
async def test_warning_acceptance_cannot_skip_review_or_reuse_after_edit(client, db_session, monkeypatch):
    headers, generation = await seeded(client, db_session)
    monkeypatch.setattr(editor, "node_quality_check", AsyncMock(return_value={"quality_results": "FAIL [grounding]: Check the claim", "substance_score": 4, "is_hard_failure": True}))
    url = f"/api/generations/{generation.id}"
    assert client.post(url + "/finalize", headers=headers, json={"accept_warnings": True}).status_code == 409
    review = client.post(url + "/finalize", headers=headers, json={}).json()
    edited = client.patch(url, headers=headers, json={"draft_index": 1, "content": "A different saved draft.", "expected_updated_at": review["updated_at"]})
    assert edited.status_code == 200, edited.text
    stale = client.post(url + "/finalize", headers=headers, json={"accept_warnings": True, "review_token": review["quality"]["review_token"]})
    assert stale.status_code == 409
    assert client.get(url + "/full", headers=headers).json()["status"] != "finalized"

@pytest.mark.asyncio
async def test_voice_learning_outage_does_not_undo_finalization(client, db_session, monkeypatch):
    headers, generation = await seeded(client, db_session)
    monkeypatch.setattr(editor, "node_quality_check", AsyncMock(return_value={"quality_results": "PASS", "substance_score": 8}))
    monkeypatch.setattr(editor, "invoke_with_bounded_backoff", AsyncMock(side_effect=RuntimeError("offline")))
    result = client.post(f"/api/generations/{generation.id}/finalize", headers=headers, json={})
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "finalized"
    assert result.json()["style_learned"] is False
    assert result.json()["warning"]

@pytest.mark.asyncio
@pytest.mark.parametrize("status,content,expected", [("generating", "Not done", 409), ("editing", "   ", 400)])
async def test_empty_or_running_drafts_cannot_be_finalized(client, db_session, status, content, expected):
    headers, generation = await seeded(client, db_session, status=status)
    generation.draft_1 = content
    await db_session.commit()
    result = client.post(f"/api/generations/{generation.id}/finalize", headers=headers, json={})
    assert result.status_code == expected

@pytest.mark.asyncio
async def test_review_supports_research_without_redundant_topic_metadata(client, db_session):
    headers, generation = await seeded(client, db_session)
    generation.research_data = {"source": "synthetic_structure", "confidence": "low", "sources": []}
    await db_session.commit()
    result = client.post(f"/api/generations/{generation.id}/finalize", headers=headers, json={})
    assert result.status_code == 200, result.text
    assert result.json()["status"] in {"finalized", "needs_review"}
