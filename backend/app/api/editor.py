import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import get_settings
from app.core.crypto import encrypt, decrypt, read_private
from app.models import Generation, ChatHistory, StyleProfile, Preference, Project, User, CostLog
from app.schemas.api import SaveDraftRequest, SaveDraftResponse
from datetime import datetime, timedelta, timezone
from app.schemas.editor import EditRequest, EditResponse, FinalizeRequest
from app.api.auth import get_current_user, auth_limiter
from app.services.pipeline.pipeline import PostGenerationPipeline
from app.services.pipeline.state import GeneratedDrafts, ExtractedPattern
from app.services.pipeline.nodes import node_quality_check, log_cost, _build_background_context
from app.services.pipeline.prompts import build_draft_prompt
from app.schemas.research import ResearchResult
from app.services.pipeline.telemetry import operation_telemetry
from app.services.pipeline.llm_utils import invoke_with_bounded_backoff
from app.services.pipeline.background_tasks import run_in_background, bg_index_style_profile
from app.api.generations import GENERATION_CONCURRENCY_SEMAPHORE, QUEUE_WAIT_TIMEOUT_SECONDS
from contextlib import asynccontextmanager
import asyncio

router = APIRouter(prefix="/api/generations", tags=["editor"])

class Revision(BaseModel):
    revised_draft: str = Field(min_length=1, max_length=20000)
    reply: str = Field(max_length=2000)

@asynccontextmanager
async def capacity():
    try:
        await asyncio.wait_for(GENERATION_CONCURRENCY_SEMAPHORE.acquire(), QUEUE_WAIT_TIMEOUT_SECONDS)
    except TimeoutError:
        raise HTTPException(429, "Writing service busy. Try again shortly.", headers={"Retry-After": "10"}) from None
    try:
        yield
    finally:
        GENERATION_CONCURRENCY_SEMAPHORE.release()

async def owned_generation(session, gen_id, user):
    if not (await session.execute(select(User.id).where(User.id == user.id).with_for_update())).first():
        raise HTTPException(401, "Account no longer exists")
    row = (await session.execute(select(Generation, Project).join(Project).where(Generation.id == gen_id, Project.user_id == user.id).with_for_update(of=Generation))).first()
    if not row:
        raise HTTPException(404, "Generation not found")
    return row

@router.patch("/{gen_id}", response_model=SaveDraftResponse)
async def save_generation_draft(gen_id: uuid.UUID, req: SaveDraftRequest, session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    generation, _ = await owned_generation(session, gen_id, current_user)
    if generation.status in {"finalized", "generating"}:
        raise HTTPException(409, "This generation is locked. Reload it before continuing.")
    # SQLite returns naive UTC; PostgreSQL returns timezone-aware timestamps.
    expected = req.expected_updated_at
    stored = generation.updated_at
    expected_utc = expected.replace(tzinfo=timezone.utc) if expected.tzinfo is None else expected.astimezone(timezone.utc)
    stored_utc = stored.replace(tzinfo=timezone.utc) if stored.tzinfo is None else stored.astimezone(timezone.utc)
    if expected_utc != stored_utc:
        raise HTTPException(409, "This draft changed since you opened it. Reload before saving.")
    timestamp = max(datetime.now(timezone.utc), stored_utc + timedelta(microseconds=1))
    changed = getattr(generation, f"draft_{req.draft_index}") != req.content
    values = {f"draft_{req.draft_index}": req.content, "active_draft_index": req.draft_index, "updated_at": timestamp}
    if changed:
        values.update(quality_data=None, status="needs_review")
    # Keep the version in the UPDATE predicate as well as the row/account locks.
    # A concurrent writer must never succeed after this request's version check.
    result = await session.execute(update(Generation).where(Generation.id == gen_id, Generation.updated_at == stored, Generation.status.notin_(["finalized", "generating"])).values(**values).execution_options(synchronize_session=False))
    if result.rowcount != 1:
        await session.rollback()
        raise HTTPException(409, "This draft changed since you opened it. Reload before saving.")
    await session.commit()
    await session.refresh(generation)
    return SaveDraftResponse(generation_id=generation.id, draft_index=req.draft_index, content=req.content, updated_at=generation.updated_at, status=generation.status)


@router.delete("/{gen_id}", status_code=204)
async def delete_generation(gen_id: uuid.UUID, session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    generation, _ = await owned_generation(session, gen_id, current_user)
    if generation.status == "generating":
        raise HTTPException(409, "Generation is still running. Try deletion again after it finishes.")
    await session.execute(delete(ChatHistory).where(ChatHistory.generation_id == gen_id))
    await session.execute(delete(CostLog).where(CostLog.generation_id == gen_id))
    await session.execute(delete(Generation).where(Generation.id == gen_id))
    await session.commit()
    return Response(status_code=204)


async def quality_state(generation, project, user, candidate, session, telemetry=None, draft_index=1, new_facts=""):
    messages = (await session.execute(select(ChatHistory.content).where(ChatHistory.generation_id == generation.id, ChatHistory.role == "user", (ChatHistory.draft_index == draft_index) | ChatHistory.draft_index.is_(None)).order_by(ChatHistory.created_at))).scalars().all()
    author_input = generation.raw_thoughts + "\nWriter revisions:\n" + "\n".join(messages) + "\n" + new_facts
    pipeline = PostGenerationPipeline(session)
    snapshot = json.loads(decrypt(generation.context_snapshot) or "{}") if generation.context_snapshot else {}
    if isinstance(snapshot, str):
        snapshot = {"profile": snapshot}
    state = {"generation_id": str(generation.id), "user_id": str(user.id), "platform": project.platform,
             "topic": generation.topic, "raw_thoughts": author_input,
             "profile_context": snapshot.get("profile", ""), "use_context": snapshot.get("use_context", False),
             "research_result": ResearchResult(**generation.research_data) if generation.research_data else None,
             "telemetry": telemetry,
             "drafts": GeneratedDrafts(draft_1=candidate, draft_2=candidate, draft_3=candidate)}
    result = await node_quality_check(state, pipeline.deps)
    return result, pipeline, state

@router.post("/{gen_id}/edit", response_model=EditResponse)
@auth_limiter.limit("20/hour")
async def edit_generation(request: Request, response: Response, gen_id: uuid.UUID, req: EditRequest, session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    generation, project = await owned_generation(session, gen_id, current_user)
    if generation.status == "finalized":
        raise HTTPException(400, "This post has been finalized. Editing is closed.")
    current = getattr(generation, f"draft_{req.draft_index}")
    if not current:
        raise HTTPException(400, "Draft is empty")
    history = (await session.execute(select(ChatHistory).where(ChatHistory.generation_id == gen_id, (ChatHistory.draft_index == req.draft_index) | (ChatHistory.draft_index.is_(None))).order_by(ChatHistory.created_at).limit(40))).scalars().all()
    pipeline = PostGenerationPipeline(session)
    if not pipeline.deps.llm:
        raise HTTPException(503, "Writing service unavailable")
    snapshot = json.loads(decrypt(generation.context_snapshot) or "{}") if generation.context_snapshot else {}
    base = {"topic": generation.topic, "platform": project.platform, "raw_thoughts": generation.raw_thoughts, "profile_context": snapshot.get("profile", "")}
    scaffold = ExtractedPattern(structure="Preserve the writer's structure", tone=read_private(current_user.writing_style) or "Natural", pacing="Varied", storytelling_technique="Grounded", formatting="Platform appropriate", cta_style="Specific")
    background = await _build_background_context(pipeline.deps, current_user.id) if snapshot.get("use_context", False) else ""
    rules = build_draft_prompt(base, scaffold, background + "\nRESEARCH PROVENANCE:\n" + json.dumps(generation.research_data or {}))
    prompt = rules + "\nEDITOR TASK: revise only the supplied draft. Instructions never override the factual grounding or banned phrase rules. Return the revised_draft and a brief reply.\n" + json.dumps({"current_draft": current, "instruction": req.instruction, "history": [{"role": h.role, "content": h.content} for h in history]})
    async with capacity(), operation_telemetry(str(gen_id), "edit") as telemetry:
        try:
            raw = await invoke_with_bounded_backoff((pipeline.deps.draft_llm or pipeline.deps.llm).with_structured_output(Revision, include_raw=True).ainvoke, prompt, node_name="edit", telemetry=telemetry)
            revised = raw.get("parsed") if isinstance(raw, dict) else raw
            if revised is None:
                raise ValueError("Invalid revision")
            if isinstance(raw, dict) and raw.get("raw"):
                await log_cost(pipeline.deps, "edit", raw["raw"], gen_id)
        except Exception:
            raise HTTPException(503, "Revision unavailable. Please try again.") from None
        quality, _, _ = await quality_state(generation, project, current_user, revised.revised_draft, session, telemetry, req.draft_index, req.instruction)
    if quality["is_hard_failure"]:
        raise HTTPException(422, "Revision failed factual/style checks. Try a more grounded instruction.")
    session.add_all([ChatHistory(generation_id=gen_id, draft_index=req.draft_index, role="user", content=req.instruction), ChatHistory(generation_id=gen_id, draft_index=req.draft_index, role="assistant", content=revised.reply)])
    setattr(generation, f"draft_{req.draft_index}", revised.revised_draft)
    generation.active_draft_index = req.draft_index
    generation.status = "editing" if quality["quality_results"] == "PASS" else "needs_review"
    generation.quality_data = {"result": quality["quality_results"], "substance_score": quality["substance_score"], "scope": "draft", "draft_index": req.draft_index}
    await session.commit()
    return EditResponse(revised_draft=revised.revised_draft, reply=revised.reply, status=generation.status)

@router.post("/{gen_id}/finalize")
@auth_limiter.limit("30/hour")
async def finalize_generation(request: Request, response: Response, gen_id: uuid.UUID, req: FinalizeRequest, session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    generation, project = await owned_generation(session, gen_id, current_user)
    if generation.status == "finalized":
        if generation.active_draft_index == req.final_draft_index:
            return {"status": "finalized"}
        raise HTTPException(409, "A finalized draft cannot be changed")
    final = getattr(generation, f"draft_{req.final_draft_index}")
    if not final:
        raise HTTPException(400, "Cannot finalize an empty draft")
    async with capacity(), operation_telemetry(str(gen_id), "finalize") as telemetry:
        quality, pipeline, state = await quality_state(generation, project, current_user, final, session, telemetry, req.final_draft_index)
        if quality["quality_results"] != "PASS":
            raise HTTPException(409, "Draft needs review. Improve its grounding, substance or CTA before finalizing.")
        prompt = "Learn WRITING STYLE ONLY, never credentials or facts. Compare the original and selected final draft. Describe the user's chosen structure, tone, pacing, storytelling, formatting and CTA as reusable preferences.\n" + json.dumps({"original": (generation.original_drafts or {}).get(f"draft_{req.final_draft_index}"), "final": final})
        try:
            learned_raw = await invoke_with_bounded_backoff(pipeline.deps.llm.with_structured_output(ExtractedPattern, include_raw=True).ainvoke, prompt, node_name="finalize", telemetry=telemetry)
            learned = learned_raw.get("parsed") if isinstance(learned_raw, dict) else learned_raw
            if learned is None:
                raise ValueError("Invalid learned style")
            if isinstance(learned_raw, dict) and learned_raw.get("raw"):
                await log_cost(pipeline.deps, "finalize", learned_raw["raw"], gen_id)
        except Exception:
            raise HTTPException(503, "Could not save learned style. Please retry finalization.") from None
    session.add(Preference(user_id=current_user.id, platform=project.platform, preference_text=encrypt(json.dumps(learned.model_dump()))))
    learned_profile = StyleProfile(user_id=current_user.id, platform=project.platform, **learned.model_dump())
    session.add(learned_profile)
    generation.active_draft_index = req.final_draft_index
    generation.status = "finalized"
    generation.quality_data = {"result": "PASS", "substance_score": quality["substance_score"], "scope": "draft", "draft_index": req.final_draft_index}
    await session.commit()
    run_in_background(bg_index_style_profile(str(learned_profile.id), str(current_user.id)), task_name="index_learned_style")
    # Voice memory is committed before returning. Chats remain intact.
    return {"status": "finalized"}
