import uuid
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.resume import ResumeSummary
from app.services.pipeline.nodes import _build_background_context
from app.services.pipeline.deps import PipelineDeps
from app.models import User

@pytest.mark.asyncio
async def test_resume_lifecycle_and_context(client: TestClient, db_session: AsyncSession):
    # 1. Signup user
    username = f"resumer_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/auth/signup", json={"username": username, "password": "password123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. GET resume initially -> null
    get_res = client.get("/api/users/me/resume", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json() is None

    # 3. Upload resume with mocked Gemini summarization
    mock_summary = ResumeSummary(
        role="Founding Engineer",
        industry="B2B SaaS",
        expertise_areas=["Python", "FastAPI", "React"],
        experience_level="senior",
        past_employer="Stripe",
        education="BS Computer Science",
    )

    with patch("app.api.users.summarize_to_structured", new=AsyncMock(return_value=mock_summary)):
        files = {"file": ("my_resume.txt", b"Founding Engineer at Stripe building B2B SaaS with Python and React.", "text/plain")}
        upload_res = client.post("/api/users/me/resume", headers=headers, files=files)
        assert upload_res.status_code == 200
        data = upload_res.json()
        assert data["filename"] == "my_resume.txt"
        assert data["structured_summary"]["role"] == "Founding Engineer"
        assert data["structured_summary"]["industry"] == "B2B SaaS"
        assert "Python" in data["structured_summary"]["expertise_areas"]

    # 4. GET resume again -> returns decoded structured summary
    get_res2 = client.get("/api/users/me/resume", headers=headers)
    assert get_res2.status_code == 200
    r_data = get_res2.json()
    assert r_data["filename"] == "my_resume.txt"
    assert r_data["structured_summary"]["role"] == "Founding Engineer"

    # 5. Verify background context injection
    from sqlalchemy import select
    user_stmt = select(User).where(User.username == username)
    user_res = await db_session.execute(user_stmt)
    u = user_res.scalars().first()
    u.about_me = "I write about early-stage engineering."
    await db_session.commit()

    from app.core.config import get_settings
    deps = PipelineDeps(session=db_session, llm=None, settings=get_settings())
    bg_context = await _build_background_context(deps, str(u.id))
    assert "Role: Founding Engineer" in bg_context
    assert "Industry: B2B SaaS" in bg_context
    assert "About the author: I write about early-stage engineering." in bg_context

    # 6. Delete resume
    del_res = client.delete("/api/users/me/resume", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # 7. GET resume after delete -> null
    get_res3 = client.get("/api/users/me/resume", headers=headers)
    assert get_res3.status_code == 200
    assert get_res3.json() is None


def test_extract_text_formats():
    from app.services.resume import extract_text
    import io
    import pypdf

    # 1. Plain text extraction
    txt_content = b"Senior Software Engineer with 8 years experience"
    assert extract_text(txt_content, "text/plain", "resume.txt") == txt_content.decode("utf-8")

    # 2. PDF extraction using pypdf writer
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()
    # Empty PDF returns empty string (or raises if no text)
    extracted = extract_text(pdf_bytes, "application/pdf", "resume.pdf")
    assert extracted == ""

    # 3. Unsupported file type raises ValueError
    with pytest.raises(ValueError, match="Unsupported resume file type"):
        extract_text(b"\x00\x01\x02\x03\x04\x05", "image/png", "photo.png")

