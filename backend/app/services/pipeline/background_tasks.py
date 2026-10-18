import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set

from sqlalchemy.future import select
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import _session_maker
from app.models import StyleProfile, CostLog, ResearchCache, User, Generation, VectorDeletionJob, Project
from app.core.config import get_settings
from app.services.vector import vector_service

logger = logging.getLogger(__name__)

# Strong references to background tasks to prevent garbage collection mid-execution
_ACTIVE_BACKGROUND_TASKS: Set[asyncio.Task] = set()



def run_in_background(coro, task_name: str = "bg_task") -> asyncio.Task:
    """Schedules an async coroutine in the background, keeping a strong reference until done."""
    task = asyncio.create_task(coro, name=task_name)
    _ACTIVE_BACKGROUND_TASKS.add(task)
    task.add_done_callback(_ACTIVE_BACKGROUND_TASKS.discard)
    return task


async def bg_save_and_cleanup_style_profile(
    generation_id: str,
    user_id: str,
    platform: str,
    extracted_dict: Dict[str, Any],
    keep_profiles: int = 10,
) -> None:
    """
    Background worker that saves the extracted StyleProfile to Postgres,
    indexes it in ChromaDB, and prunes stale profiles beyond `keep_profiles`.
    Runs with its own isolated database session so failures never affect generation.
    """
    try:
        async with _session_maker() as session:
            # Row lock serializes vector writes with account deletion across workers.
            user = (await session.execute(select(User).where(User.id == uuid.UUID(str(user_id))).with_for_update())).scalars().first()
            if not user or await session.get(VectorDeletionJob, user.id):
                return
            profile = StyleProfile(
                user_id=uuid.UUID(str(user_id)),
                platform=platform,
                structure=extracted_dict.get("structure", ""),
                tone=extracted_dict.get("tone", ""),
                pacing=extracted_dict.get("pacing", ""),
                storytelling_technique=extracted_dict.get("storytelling_technique", ""),
                formatting=extracted_dict.get("formatting", ""),
                cta_style=extracted_dict.get("cta_style", ""),
            )
            session.add(profile)
            await session.flush()

            style_concat = (
                f"Structure: {profile.structure} | Tone: {profile.tone} | "
                f"Pacing: {profile.pacing} | Storytelling: {profile.storytelling_technique} | "
                f"Format: {profile.formatting} | CTA: {profile.cta_style}"
            )

            # Save to vector store
            try:
                await asyncio.to_thread(vector_service.save_style_profile, str(profile.id), str(user_id), platform, style_concat, profile.created_at.isoformat())
                await asyncio.to_thread(vector_service.delete_oldest_profiles, str(user_id), platform, keep_profiles)
            except Exception as ve:
                logger.warning(
                    f"[Generation {generation_id}] Non-fatal vector store save warning: {type(ve).__name__}"
                )

            # Cleanup old profiles
            stmt = (
                select(StyleProfile)
                .where(
                    StyleProfile.user_id == uuid.UUID(str(user_id)),
                    StyleProfile.platform == platform,
                )
                .order_by(StyleProfile.created_at.desc(), StyleProfile.id.desc())
            )
            result = await session.execute(stmt)
            profiles = list(result.scalars().all())

            if len(profiles) > keep_profiles:
                to_delete = profiles[keep_profiles:]
                for p in to_delete:
                    await session.delete(p)
            await session.commit()

        logger.info(f"[Generation {generation_id}] Successfully persisted and pruned style profile.")
    except Exception as e:
        logger.error(
            f"[Generation {generation_id}] Background style profile write failed: {type(e).__name__}",
            exc_info=False,
        )


async def bg_log_cost(
    generation_id: str,
    operation: str,
    prompt_tokens: int,
    completion_tokens: int,
    user_id: str | None = None,
    model: str | None = None,
) -> None:
    """
    Background worker that records an LLM token usage and cost entry
    using an isolated database session.
    """
    try:
        settings = get_settings()
        selected_model = model or settings.GEMINI_MODEL
        rates = settings.MODEL_TOKEN_PRICES.get(selected_model, {})
        cost = (prompt_tokens * rates.get("prompt", settings.COST_PROMPT_PER_MILLION) + completion_tokens * rates.get("completion", settings.COST_COMPLETION_PER_MILLION)) / 1_000_000
        gen_id = uuid.UUID(str(generation_id)) if generation_id else None

        async with _session_maker() as session:
            if gen_id:
                owner = (await session.execute(select(Project.user_id).join(Generation).where(Generation.id == gen_id))).scalar_one_or_none()
                if owner is None:
                    return
            else:
                owner = uuid.UUID(user_id) if user_id else None
            if owner and (not await session.get(User, owner) or await session.get(VectorDeletionJob, owner)):
                return
            cost_log = CostLog(
                generation_id=gen_id,
                user_id=owner,
                model_name=selected_model,
                operation=operation,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                estimated_cost_usd=cost,
            )
            session.add(cost_log)
            await session.commit()
    except Exception as e:
        logger.error(
            f"[Generation {generation_id}] Background cost log write failed for operation '{operation}': {type(e).__name__}",
            exc_info=False,
        )


async def bg_save_research_cache(
    generation_id: Optional[str],
    topic: str,
    platform: str,
    snippets: List[str],
    ttl_hours: int = 24,
    sources: list | None = None,
    source: str = "general_search",
    confidence: str = "medium",
) -> None:
    """
    Background worker that stores Tavily/Serp search results into the ResearchCache
    using an isolated database session.
    """
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        cache_entry = ResearchCache(
            topic=__import__("hashlib").sha256(topic.encode()).hexdigest(),
            platform=platform,
            results_json=json.dumps({"content_snippets": snippets, "sources": sources or [], "source": source, "confidence": confidence}),
            expires_at=expires_at,
        )
        async with _session_maker() as session:
            await session.execute(delete(ResearchCache).where(ResearchCache.expires_at < datetime.now(timezone.utc)))
            session.add(cache_entry)
            await session.commit()
        logger.info(f"[Generation {generation_id or 'unknown'}] Background research cache entry saved.")
    except Exception as e:
        logger.error(
            f"[Generation {generation_id or 'unknown'}] Background research cache write failed: {type(e).__name__}",
            exc_info=False,
        )


async def wait_background_tasks(timeout: float = 2.0) -> None:
    """Waits for all active background tasks to complete (useful in tests and shutdown)."""
    if _ACTIVE_BACKGROUND_TASKS:
        tasks = [t for t in _ACTIVE_BACKGROUND_TASKS if not t.done()]
        if tasks:
            await asyncio.wait(tasks, timeout=timeout)

async def bg_index_style_profile(profile_id: str, user_id: str):
    """Index a committed learned profile without creating another database row."""
    try:
        async with _session_maker() as session:
            user = (await session.execute(select(User).where(User.id == uuid.UUID(user_id)).with_for_update())).scalars().first()
            if not user or await session.get(VectorDeletionJob, user.id):
                return
            profile = await session.get(StyleProfile, uuid.UUID(profile_id))
            if not profile or profile.user_id != user.id:
                return
            text = " | ".join(f"{field}: {getattr(profile, field) or ''}" for field in ("structure", "tone", "pacing", "storytelling_technique", "formatting", "cta_style"))
            await asyncio.to_thread(vector_service.save_style_profile, profile_id, user_id, profile.platform, text, profile.created_at.isoformat())
            await asyncio.to_thread(vector_service.delete_oldest_profiles, user_id, profile.platform, 10)
            profiles = (await session.execute(select(StyleProfile).where(StyleProfile.user_id == user.id, StyleProfile.platform == profile.platform).order_by(StyleProfile.created_at.desc(), StyleProfile.id.desc()).offset(10))).scalars().all()
            for old in profiles:
                await session.delete(old)
            await session.commit()
    except Exception:
        logger.warning("Learned profile indexing unavailable; PostgreSQL memory retained")
