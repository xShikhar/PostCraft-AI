import asyncio
import sys
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Response
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.api.auth import get_current_user, auth_limiter
from app.core.config import get_settings
from app.core.crypto import encrypt, decrypt, read_private
from app.models import User, StyleProfile, UserResume, Project, Generation, CostLog, AdminAuditLog, VectorDeletionJob, Preference
from app.schemas.api import UserResponse, UserUpdate
from app.services.resume import extract_text, summarize_to_structured
from app.services.deletion import erase_vectors

router = APIRouter(prefix="/api/users", tags=["users"])

def user_response(user):
    return UserResponse(id=user.id, username=user.username, is_admin=user.is_admin,
                        profile_context=read_private(user.profile_context), about_me=read_private(user.about_me), writing_style=read_private(user.writing_style))

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return user_response(current_user)

@router.patch("/me", response_model=UserResponse)
@auth_limiter.limit("30/hour")
async def update_me(request: Request, response: Response, update_data: UserUpdate, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    for name in update_data.model_fields_set:
        setattr(current_user, name, encrypt(getattr(update_data, name)))
    await session.commit()
    return user_response(current_user)

@router.get("/me/style-profile")
async def get_style_profile(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db), platform: Literal["linkedin", "x"] | None = None):
    stmt = select(StyleProfile).where(StyleProfile.user_id == current_user.id).order_by(StyleProfile.created_at.desc(), StyleProfile.id.desc()).limit(5)
    if platform:
        stmt = stmt.where(StyleProfile.platform == platform)
    profiles = (await session.execute(stmt)).scalars().all()
    def item(p):
        return {"id": str(p.id), "platform": p.platform, "created_at": p.created_at.isoformat(), **{name: getattr(p, name) for name in ("structure", "tone", "pacing", "storytelling_technique", "formatting", "cta_style")}}
    return {"current": item(profiles[0]) if profiles else None, "history": [item(p) for p in profiles]}

class ResumeResponse(BaseModel):
    id: str
    filename: str
    structured_summary: dict | None = None
    uploaded_at: str
    raw_text_length: int
    raw_text: str

class ResumeUpdate(BaseModel):
    raw_text: str = Field(min_length=10, max_length=100000)

def resume_response(resume):
    raw = decrypt(resume.raw_text) or ""
    return ResumeResponse(id=str(resume.id), filename=resume.filename, structured_summary=json.loads(decrypt(resume.structured_summary) or "{}"), uploaded_at=resume.uploaded_at.isoformat(), raw_text_length=len(raw), raw_text=raw)

async def save_resume(raw_text, filename, user, session):
    try:
        summary = await summarize_to_structured(raw_text, get_settings().GEMINI_API_KEY, user_id=str(user.id))
    except Exception:
        raise HTTPException(status_code=503, detail="Resume analysis unavailable. Please try again.") from None
    resume = (await session.execute(select(UserResume).where(UserResume.user_id == user.id))).scalars().first()
    if not resume:
        resume = UserResume(user_id=user.id)
        session.add(resume)
    resume.filename = filename
    resume.raw_text = encrypt(raw_text)
    resume.structured_summary = encrypt(json.dumps(summary.model_dump()))
    resume.uploaded_at = datetime.now(timezone.utc)
    await session.commit()
    return resume_response(resume)

@router.post("/me/resume", response_model=ResumeResponse)
@auth_limiter.limit("10/hour")
async def upload_resume(request: Request, response: Response, file: UploadFile = File(...), current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    data = bytearray()
    while chunk := await file.read(65536):
        data.extend(chunk)
        if len(data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Resume file too large (max 5MB)")
    filename = (file.filename or "resume.txt").replace("\\", "/").split("/")[-1][:255]
    try:
        process = await asyncio.create_subprocess_exec(sys.executable, "-m", "app.services.resume_extract", filename, file.content_type or "", stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            output, _ = await asyncio.wait_for(process.communicate(bytes(data)), timeout=15)
        except BaseException:
            process.kill()
            await process.wait()
            raise
        if process.returncode:
            raise ValueError("Invalid document")
        raw = output.decode("utf-8")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume. Use a text-based PDF (up to 50 pages), DOCX, TXT or Markdown within 5MB.") from None
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Resume has no extractable text")
    return await save_resume(raw, filename, current_user, session)

@router.get("/me/resume", response_model=ResumeResponse | None)
async def get_resume(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    resume = (await session.execute(select(UserResume).where(UserResume.user_id == current_user.id))).scalars().first()
    return resume_response(resume) if resume else None

@router.patch("/me/resume", response_model=ResumeResponse)
@auth_limiter.limit("10/hour")
async def update_resume(request: Request, response: Response, data: ResumeUpdate, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    resume = (await session.execute(select(UserResume).where(UserResume.user_id == current_user.id))).scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="No resume to edit")
    return await save_resume(data.raw_text, resume.filename, current_user, session)

@router.delete("/me/resume")
@auth_limiter.limit("30/hour")
async def delete_resume(request: Request, response: Response, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    await session.execute(delete(UserResume).where(UserResume.user_id == current_user.id))
    await session.commit()
    return {"status": "success", "message": "Resume deleted"}

@router.delete("/me")
@auth_limiter.limit("5/hour")
async def delete_my_account(request: Request, response: Response, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    # This lock waits for any in-flight vector writer's transaction before deletion.
    await session.execute(select(User.id).where(User.id == current_user.id).with_for_update())
    user_id = current_user.id
    session.add(VectorDeletionJob(user_id=user_id))
    gen_ids = select(Generation.id).join(Project).where(Project.user_id == user_id)
    await session.execute(delete(CostLog).where((CostLog.generation_id.in_(gen_ids)) | (CostLog.user_id == user_id)))
    await session.execute(update(AdminAuditLog).where(AdminAuditLog.admin_user_id == user_id).values(admin_user_id=None))
    await session.execute(update(AdminAuditLog).where(AdminAuditLog.target_user_id == user_id).values(target_user_id=None))
    await session.delete(current_user)
    await session.commit()
    try:
        await erase_vectors(user_id, session)
    except Exception:
        await session.rollback()
        response.status_code = 202
        return {"status": "deletion_pending", "message": "Account data deleted. Vector erasure is queued and will retry automatically."}
    return {"status": "success", "message": "Account and associated data deleted."}

@router.get("/me/export")
async def export_my_data(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)):
    from app.api.generations import get_generation_full
    ids = (await session.execute(select(Generation.id).join(Project).where(Project.user_id == current_user.id))).scalars().all()
    styles = (await session.execute(select(StyleProfile).where(StyleProfile.user_id == current_user.id))).scalars().all()
    preferences = (await session.execute(select(Preference).where(Preference.user_id == current_user.id))).scalars().all()
    return {"profile": user_response(current_user).model_dump(mode="json"), "resume": await get_resume(current_user, session),
            "styles": [{field: getattr(style, field) for field in ("platform", "structure", "tone", "pacing", "storytelling_technique", "formatting", "cta_style")} for style in styles],
            "preferences": [{"platform": pref.platform, "text": read_private(pref.preference_text)} for pref in preferences],
            "generations": [await get_generation_full(str(gid), session, current_user) for gid in ids]}
