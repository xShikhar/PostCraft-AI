from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
import json
import logging

from app.core.database import get_db
from app.api.auth import get_current_user
from app.core.config import get_settings
from app.core.crypto import encrypt, decrypt
from app.models import User, StyleProfile, UserResume
from app.schemas.api import UserResponse, UserUpdate
from app.services.resume import extract_text, summarize_to_structured
from app.services.vector import vector_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


# ---------------------------------------------------------------------------
# Pydantic schemas for the new endpoints
# ---------------------------------------------------------------------------

class ResumeResponse(BaseModel):
    id: str
    filename: str
    structured_summary: Optional[dict] = None
    uploaded_at: str
    raw_text_length: int


class ResumeDeleteResponse(BaseModel):
    status: str
    message: str


# ---------------------------------------------------------------------------
# User profile endpoints
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    if update_data.profile_context is not None:
        current_user.profile_context = update_data.profile_context
    if update_data.about_me is not None:
        current_user.about_me = update_data.about_me

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# Style profile endpoint (from Chunk 1)
# ---------------------------------------------------------------------------

@router.get("/me/style-profile")
async def get_style_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    platform: str | None = None,
):
    """
    Returns the user's current (most recent) StyleProfile for a given platform,
    plus a small history of the last 5 timestamps to show trajectory.
    Optionally filter by platform (linkedin / x).
    """
    stmt = (
        select(StyleProfile)
        .where(StyleProfile.user_id == current_user.id)
        .order_by(StyleProfile.id.desc())
        .limit(5)
    )
    if platform:
        stmt = stmt.where(StyleProfile.platform == platform)

    res = await session.execute(stmt)
    profiles = res.scalars().all()

    if not profiles:
        return {
            "current": None,
            "history": [],
            "message": "No style profile yet. Generate a post first to start learning your style.",
        }

    current = profiles[0]
    history = [
        {
            "id": str(p.id),
            "platform": p.platform,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in profiles
    ]

    return {
        "current": {
            "id": str(current.id),
            "platform": current.platform,
            "structure": current.structure,
            "tone": current.tone,
            "pacing": current.pacing,
            "storytelling_technique": current.storytelling_technique,
            "formatting": current.formatting,
            "cta_style": current.cta_style,
            "created_at": current.created_at.isoformat() if current.created_at else None,
        },
        "history": history,
    }


# ---------------------------------------------------------------------------
# Resume endpoints
# ---------------------------------------------------------------------------

@router.post("/me/resume", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Upload a resume (PDF/DOCX/text). The file is parsed, summarized once
    via Gemini into a structured profile, and stored. Re-uploading overwrites
    the previous resume for the user.
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key missing")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(file_bytes) > 5 * 1024 * 1024:  # 5MB cap
        raise HTTPException(status_code=400, detail="Resume file too large (max 5MB)")

    mime_type = file.content_type or "application/octet-stream"

    try:
        raw_text = extract_text(file_bytes, mime_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not raw_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from the file. It may be a scanned image or encrypted PDF."
        )

    # One-shot Gemini summarization
    summary = await summarize_to_structured(raw_text, settings.GEMINI_API_KEY)
    summary_dict = summary.model_dump()

    # Upsert: if user already has a resume, replace it
    stmt = select(UserResume).where(UserResume.user_id == current_user.id)
    res = await session.execute(stmt)
    existing = res.scalars().first()

    if existing:
        existing.filename = file.filename or "resume"
        # Encrypt PII (raw_text and structured_summary) at rest
        existing.raw_text = encrypt(raw_text)
        existing.structured_summary = encrypt(json.dumps(summary_dict))
        existing.uploaded_at = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
        resume = existing
    else:
        resume = UserResume(
            user_id=current_user.id,
            filename=file.filename or "resume",
            raw_text=encrypt(raw_text),
            structured_summary=encrypt(json.dumps(summary_dict)),
        )
        session.add(resume)

    await session.commit()
    await session.refresh(resume)

    return ResumeResponse(
        id=str(resume.id),
        filename=resume.filename,
        structured_summary=summary_dict,
        uploaded_at=resume.uploaded_at.isoformat() if resume.uploaded_at else "",
        raw_text_length=len(raw_text),
    )


@router.get("/me/resume", response_model=Optional[ResumeResponse])
async def get_resume(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Returns the user's current resume (or null if none uploaded)."""
    stmt = select(UserResume).where(UserResume.user_id == current_user.id)
    res = await session.execute(stmt)
    resume = res.scalars().first()

    if not resume:
        return None

    summary_dict = None
    if resume.structured_summary:
        try:
            # Decrypt the structured summary before parsing
            summary_dict = json.loads(decrypt(resume.structured_summary))
        except (json.JSONDecodeError, Exception):
            summary_dict = None

    # raw_text_length is the plaintext length (informational only — we never
    # decrypt raw_text in API responses, since the user already saw it via
    # the upload response).
    plaintext_length = 0
    if resume.raw_text:
        try:
            plaintext_length = len(decrypt(resume.raw_text))
        except Exception:
            plaintext_length = 0

    return ResumeResponse(
        id=str(resume.id),
        filename=resume.filename,
        structured_summary=summary_dict,
        uploaded_at=resume.uploaded_at.isoformat() if resume.uploaded_at else "",
        raw_text_length=plaintext_length,
    )


@router.delete("/me/resume", response_model=ResumeDeleteResponse)
async def delete_resume(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Deletes the user's current resume. The next generation will no longer
    inject resume context. The deletion is immediate (no caching) — the
    next draft_generation call will see no resume row.
    """
    stmt = select(UserResume).where(UserResume.user_id == current_user.id)
    res = await session.execute(stmt)
    resume = res.scalars().first()

    if not resume:
        raise HTTPException(status_code=404, detail="No resume to delete")

    await session.delete(resume)
    await session.commit()

    return ResumeDeleteResponse(
        status="success",
        message="Resume deleted. Future generations will no longer use it as context.",
    )


# ---------------------------------------------------------------------------
# Account deletion — cascades to resume, style profiles, projects, generations,
# chat history, preferences, and ChromaDB vectors.
# ---------------------------------------------------------------------------

class AccountDeleteResponse(BaseModel):
    status: str
    message: str


@router.delete("/me", response_model=AccountDeleteResponse)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Permanently delete the requesting user's account and all associated data.
    Cascades via SQLAlchemy `cascade="all, delete-orphan"` to:
      - UserResume (PII at rest)
      - StyleProfile
      - Preference
      - Project
      - Generation (and via cascade, ChatHistory)
    Plus explicit cleanup of ChromaDB style profile vectors.
    """
    user_id_str = str(current_user.id)

    # Delete ChromaDB entries for this user across all platforms.
    # Do this BEFORE the DB delete so we have a stable user_id reference.
    try:
        vector_service.delete_all_for_user(user_id_str)
    except Exception as e:
        # Log but don't fail the user-visible deletion — DB cleanup is the
        # primary contract. ChromaDB is best-effort cleanup.
        logger.error(f"ChromaDB cleanup failed for user {user_id_str}: {e}")

    # Delete the user row — cascades handle the rest of the relational data
    await session.delete(current_user)
    await session.commit()

    return AccountDeleteResponse(
        status="success",
        message="Account and all associated data deleted permanently.",
    )
