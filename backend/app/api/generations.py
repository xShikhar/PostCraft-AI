from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models import Project, Generation, User, ChatHistory
from app.schemas.api import GenerateRequest, GenerateResponse, SourceItemResponse
from app.services.pipeline.state import PipelineState
from app.services.pipeline import PostGenerationPipeline
from app.api.auth import get_current_user, auth_limiter

router = APIRouter(prefix="/api/generations", tags=["generations"])

@router.post("", response_model=GenerateResponse)
@auth_limiter.limit("10/hour")
async def generate_post(
    request: Request,
    req: GenerateRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch or create a project for this user/platform
    stmt = select(Project).where(
        Project.user_id == current_user.id,
        Project.platform == req.platform
    ).order_by(Project.id.desc()).limit(1)
    res = await session.execute(stmt)
    project = res.scalars().first()
    
    if not project:
        project = Project(
            user_id=current_user.id,
            name=f"{req.platform.capitalize()} Content",
            platform=req.platform
        )
        session.add(project)
        await session.commit()
        await session.refresh(project)

    # Create Generation
    gen = Generation(
        project_id=project.id,
        topic=req.topic,
        raw_thoughts=req.raw_thoughts
    )
    session.add(gen)
    await session.commit()
    await session.refresh(gen)

    # Initialize Pipeline State
    profile_ctx = req.profile_context
    if not profile_ctx and current_user.profile_context:
        profile_ctx = current_user.profile_context

    state = PipelineState(
        generation_id=gen.id,
        project_id=project.id,
        user_id=current_user.id,
        platform=req.platform,
        topic=req.topic,
        raw_thoughts=req.raw_thoughts,
        profile_context=profile_ctx,
        use_context=req.use_context,
    )

    # Run Pipeline
    pipeline = PostGenerationPipeline(session)
    final_state = await pipeline.run(state)

    # Build sources list from research result
    sources = []
    research_confidence = None
    research_source = None
    if final_state.research_result:
        research_confidence = final_state.research_result.confidence
        research_source = final_state.research_result.source
        for s in final_state.research_result.sources:
            sources.append({"title": s.title, "snippet": s.snippet, "url": s.url})

    return GenerateResponse(
        generation_id=final_state.generation_id,
        status=final_state.error if final_state.error else ("needs_review" if final_state.quality_results and not final_state.quality_results.startswith("PASS") else "editing"),
        draft_1=final_state.drafts.draft_1 if final_state.drafts else None,
        draft_2=final_state.drafts.draft_2 if final_state.drafts else None,
        draft_3=final_state.drafts.draft_3 if final_state.drafts else None,
        sources=sources,
        research_confidence=research_confidence,
        research_source=research_source,
        substance_score=final_state.substance_score,
        error=final_state.error
    )


# ---------------------------------------------------------------------------
# History endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_generations(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
    platform: str | None = None,
    q: str | None = None,
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
        .order_by(Generation.created_at.desc())
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
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


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
        {"role": h.role, "content": h.content}
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
    }


def _draft_preview(gen: Generation) -> str:
    """Return the first 100 chars of the active draft, or draft_1 as fallback."""
    drafts = {1: gen.draft_1, 2: gen.draft_2, 3: gen.draft_3}
    active = gen.active_draft_index or 1
    text = drafts.get(active) or gen.draft_1 or ""
    return text[:100].replace("\n", " ").strip()
