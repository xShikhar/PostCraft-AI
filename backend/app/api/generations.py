import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func
from typing import Literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models import Project, Generation, User, ChatHistory
from app.core.crypto import read_private, encrypt
from app.schemas.api import GenerateRequest, GenerateResponse, SourceItemResponse
from app.services.pipeline.state import PipelineState
from app.services.pipeline import PostGenerationPipeline
from app.api.auth import get_current_user, auth_limiter

router = APIRouter(prefix="/api/generations", tags=["generations"])

# Concurrency guard: 4 concurrent pipeline generations sized to model quota
GENERATION_CONCURRENCY_SEMAPHORE = asyncio.Semaphore(4)
QUEUE_WAIT_TIMEOUT_SECONDS = 10.0
DAILY_GENERATION_CAP = 50

@router.post("", response_model=GenerateResponse)
@auth_limiter.limit("10/hour")
async def generate_post(
    request: Request,
    response: Response,
    req: GenerateRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await asyncio.wait_for(GENERATION_CONCURRENCY_SEMAPHORE.acquire(), timeout=QUEUE_WAIT_TIMEOUT_SECONDS)
    except TimeoutError:
        raise HTTPException(status_code=429, detail="Generation capacity is busy. Try again shortly.", headers={"Retry-After": "10"}) from None
    gen = None
    try:
        locked_user = (await session.execute(select(User.id).where(User.id == current_user.id).with_for_update())).scalar_one_or_none()
        if locked_user is None:
            raise HTTPException(401, "Account no longer exists")
        today_start = datetime.now(timezone.utc) - timedelta(days=1)
        daily_count = (await session.execute(select(func.count(Generation.id)).join(Project).where(Project.user_id == current_user.id, Generation.created_at >= today_start))).scalar() or 0
        if daily_count >= DAILY_GENERATION_CAP:
            raise HTTPException(status_code=429, detail="Daily generation limit reached.", headers={"Retry-After": "86400"})
        project = (await session.execute(select(Project).where(Project.user_id == current_user.id, Project.platform == req.platform).order_by(Project.created_at.desc()).limit(1))).scalars().first()
        if not project:
            project = Project(user_id=current_user.id, name=f"{req.platform.capitalize()} Content", platform=req.platform)
            session.add(project)
            await session.flush()
        profile = (req.profile_context or read_private(current_user.profile_context)) if req.use_context else ""
        style = read_private(current_user.writing_style)
        gen = Generation(project_id=project.id, topic=req.topic, raw_thoughts=req.raw_thoughts, context_snapshot=encrypt(profile))
        session.add(gen)
        await session.commit()
        state = PipelineState(generation_id=gen.id, project_id=project.id, user_id=current_user.id, platform=req.platform, topic=req.topic, raw_thoughts=req.raw_thoughts, profile_context=profile, writing_style=style, use_context=req.use_context)
        async with asyncio.timeout(300):
            final_state = await PostGenerationPipeline(session).run(state)
        if not (await session.execute(select(User.id).where(User.id == current_user.id))).first():
            raise HTTPException(401, "Account no longer exists")
        research = final_state.research_result
        await session.refresh(gen)
        return GenerateResponse(generation_id=gen.id, updated_at=gen.updated_at, research_retrieved_at=(gen.research_data or {}).get("retrieved_at"), status="failed" if final_state.error or not final_state.drafts else ("needs_review" if not (final_state.quality_results or "").startswith("PASS") else "editing"),
            **(final_state.drafts.model_dump() if final_state.drafts else {}), sources=[item.model_dump() for item in research.sources] if research else [], research_confidence=research.confidence if research else None, research_source=research.source if research else None, substance_score=final_state.substance_score, error=final_state.error)
    except BaseException:
        await session.rollback()
        if gen:
            from sqlalchemy import update
            await session.execute(update(Generation).where(Generation.id == gen.id).values(status="failed"))
            await session.commit()
        raise
    finally:
        GENERATION_CONCURRENCY_SEMAPHORE.release()


# ---------------------------------------------------------------------------
# History endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_generations(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    platform: Literal["linkedin", "x"] | None = None,
    q: str | None = Query(default=None, max_length=255),
    status: Literal["generating", "editing", "needs_review", "failed", "finalized"] | None = None,
    sort: Literal["newest", "oldest"] = "newest",
):
    """
    Returns a paginated list of the user's generations, newest first.
    Optionally filter by platform and/or search by topic / raw_thoughts.
    Returns total count alongside the list so the frontend can show
    "Showing X of Y".
    """
    base_stmt = (
        select(Generation, Project)
        .join(Project, Generation.project_id == Project.id)
        .where(Project.user_id == current_user.id)
    )
    count_stmt = (
        select(func.count())
        .select_from(Generation)
        .join(Project, Generation.project_id == Project.id)
        .where(Project.user_id == current_user.id)
    )

    if platform:
        base_stmt = base_stmt.where(Project.platform == platform)
        count_stmt = count_stmt.where(Project.platform == platform)

    if status:
        base_stmt = base_stmt.where(Generation.status == status)
        count_stmt = count_stmt.where(Generation.status == status)

    if q:
        q_lower = f"%{q.lower()}%"
        base_stmt = base_stmt.where(
            Generation.topic.ilike(q_lower) | Generation.raw_thoughts.ilike(q_lower)
        )
        count_stmt = count_stmt.where(
            Generation.topic.ilike(q_lower) | Generation.raw_thoughts.ilike(q_lower)
        )

    # Total before pagination
    total_res = await session.execute(count_stmt)
    total = total_res.scalar() or 0

    # Paginated results
    res = await session.execute(
        base_stmt
        .order_by(Generation.created_at.asc() if sort == "oldest" else Generation.created_at.desc(), Generation.id.asc())
        .offset(offset)
        .limit(limit)
    )
    rows = res.all()

    items = []
    for row in rows:
        gen: Generation = row[0]
        items.append({
            "generation_id": str(gen.id),
            "project_id": str(gen.project_id),
            "topic": gen.topic,
            "platform": row[1].platform,
            "status": gen.status,
            "active_draft_index": gen.active_draft_index,
            "created_at": gen.created_at.isoformat() if gen.created_at else None,
            # Short preview: first 80 chars of draft_1 (or the active draft)
            "preview": _draft_preview(gen),
            "draft_1": gen.draft_1,
            "draft_2": gen.draft_2,
            "draft_3": gen.draft_3,
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/metrics")
async def generation_metrics(session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    scope = Project.user_id == current_user.id
    groups = (await session.execute(select(Generation.status, func.count()).join(Project).where(scope).group_by(Generation.status))).all()
    counts = dict(groups)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent = (await session.execute(select(Generation.created_at).join(Project).where(scope, Generation.created_at >= cutoff))).scalars().all()
    return {"total": sum(counts.values()), "finalized": counts.get("finalized", 0), "in_progress": counts.get("editing", 0) + counts.get("needs_review", 0), "recent_dates": [value.isoformat() for value in recent]}


@router.get("/{gen_id}/full")
async def get_generation_full(
    gen_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the full generation (all 3 drafts, chat history, topic, raw_thoughts, status)
    so the frontend can rehydrate the editor view from history.
    """
    import uuid

    try:
        gid = uuid.UUID(gen_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid generation ID")

    stmt = (
        select(Generation, Project)
        .join(Project, Generation.project_id == Project.id)
        .where(
            Generation.id == gid,
            Project.user_id == current_user.id,
        )
    )
    res = await session.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Generation not found")

    gen: Generation = row[0]

    # Chat history
    hist_stmt = (
        select(ChatHistory)
        .where(ChatHistory.generation_id == gid)
        .order_by(ChatHistory.created_at)
    )
    hist_res = await session.execute(hist_stmt)
    chat_history = [
        {"role": h.role, "content": h.content, "draft_index": h.draft_index or 1}
        for h in hist_res.scalars().all()
    ]

    return {
        "generation_id": str(gen.id),
        "project_id": str(gen.project_id),
        "topic": gen.topic,
        "raw_thoughts": gen.raw_thoughts,
        "platform": row[1].platform,
        "status": gen.status,
        "active_draft_index": gen.active_draft_index,
        "draft_1": gen.draft_1,
        "draft_2": gen.draft_2,
        "draft_3": gen.draft_3,
        "created_at": gen.created_at.isoformat() if gen.created_at else None,
        "updated_at": gen.updated_at.isoformat() if gen.updated_at else None,
        "chat_history": chat_history,
        "sources": (gen.research_data or {}).get("sources", []),
        "quality": gen.quality_data,
        "original_drafts": gen.original_drafts,
        "research_source": (gen.research_data or {}).get("source"),
        "research_confidence": (gen.research_data or {}).get("confidence"),
        "research_retrieved_at": (gen.research_data or {}).get("retrieved_at"),
    }


def _draft_preview(gen: Generation) -> str:
    """Return the first 100 chars of the active draft, or draft_1 as fallback."""
    drafts = {1: gen.draft_1, 2: gen.draft_2, 3: gen.draft_3}
    active = gen.active_draft_index or 1
    text = drafts.get(active) or gen.draft_1 or ""
    return text[:100].replace("\n", " ").strip()
