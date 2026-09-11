import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Generation, Project, User


@pytest.mark.asyncio
async def test_editor_edit_and_finalize_lifecycle(client: TestClient, db_session: AsyncSession):
    # 1. Signup user
    username = f"editor_user_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/auth/signup", json={"username": username, "password": "password123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch user from DB
    from sqlalchemy import select
    user_res = await db_session.execute(select(User).where(User.username == username))
    user = user_res.scalars().first()
    assert user is not None

    # 2. Create Project and Generation
    project = Project(user_id=user.id, name="Test Project", platform="linkedin")
    db_session.add(project)
    await db_session.flush()

    generation = Generation(
        project_id=project.id,
        topic="AI Architecture",
        raw_thoughts="Thoughts on AI systems",
        draft_1="Draft 1: Architecture of modern LLM systems.",
        draft_2="Draft 2: Building scalable AI applications with Python.",
        draft_3="Draft 3: Practical lessons from distributed systems.",
        status="editing",
        active_draft_index=1,
    )
    db_session.add(generation)
    await db_session.commit()
    gen_id = str(generation.id)

    # 3. Test editing Draft 1 with mock LLM
    mock_llm_response = MagicMock()
    mock_llm_response.text = '```json\n{"revised_draft": "Draft 1 Revised: LLMs in production.", "reply": "Made it punchier."}\n```'

    with patch("app.api.editor.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.return_value = mock_llm_response
        mock_client_cls.return_value = mock_instance

        # Edit Draft 1
        edit_res1 = client.post(
            f"/api/generations/{gen_id}/edit",
            json={"draft_index": 1, "instruction": "Make it punchier"},
            headers=headers,
        )
        assert edit_res1.status_code == 200
        data1 = edit_res1.json()
        assert data1["revised_draft"] == "Draft 1 Revised: LLMs in production."
        assert data1["reply"] == "Made it punchier."

        # Edit Draft 2
        mock_llm_response2 = MagicMock()
        mock_llm_response2.text = '```json\n{"revised_draft": "Draft 2 Revised: Scaling Python AI services.", "reply": "Expanded on Python."}\n```'
        mock_instance.models.generate_content.return_value = mock_llm_response2

        edit_res2 = client.post(
            f"/api/generations/{gen_id}/edit",
            json={"draft_index": 2, "instruction": "Focus on Python"},
            headers=headers,
        )
        assert edit_res2.status_code == 200
        data2 = edit_res2.json()
        assert data2["revised_draft"] == "Draft 2 Revised: Scaling Python AI services."

    # 4. Check full generation details: verify drafts updated and active draft intact
    full_res = client.get(f"/api/generations/{gen_id}/full", headers=headers)
    assert full_res.status_code == 200
    full_data = full_res.json()
    assert full_data["draft_1"] == "Draft 1 Revised: LLMs in production."
    assert full_data["draft_2"] == "Draft 2 Revised: Scaling Python AI services."
    # Verify chat history contains messages with respective draft_index
    chat_hist = full_data.get("chat_history", [])
    assert len(chat_hist) >= 4  # 2 user msgs + 2 bot msgs
    draft_1_msgs = [m for m in chat_hist if m.get("draft_index") == 1]
    draft_2_msgs = [m for m in chat_hist if m.get("draft_index") == 2]
    assert len(draft_1_msgs) >= 2
    assert len(draft_2_msgs) >= 2

    # 5. Finalize Draft 2
    with patch("app.api.editor.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_pref_response = MagicMock()
        mock_pref_response.text = "User prefers clear, structured breakdowns."
        mock_instance.models.generate_content.return_value = mock_pref_response
        mock_client_cls.return_value = mock_instance

        fin_res = client.post(
            f"/api/generations/{gen_id}/finalize",
            json={"final_draft_index": 2},
            headers=headers,
        )
        assert fin_res.status_code == 200
        assert fin_res.json()["status"] == "finalized"

    # 6. Verify full generation shows active_draft_index = 2 and status = "finalized"
    fin_full = client.get(f"/api/generations/{gen_id}/full", headers=headers)
    assert fin_full.status_code == 200
    assert fin_full.json()["status"] == "finalized"
    assert fin_full.json()["active_draft_index"] == 2

    # 7. Verify that attempting to edit after finalization is rejected with 400
    locked_edit = client.post(
        f"/api/generations/{gen_id}/edit",
        json={"draft_index": 2, "instruction": "Try editing again"},
        headers=headers,
    )
    assert locked_edit.status_code == 400
    assert "finalized" in locked_edit.json()["detail"].lower()
