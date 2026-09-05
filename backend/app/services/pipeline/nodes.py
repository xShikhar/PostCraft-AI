import json
import logging
import uuid
from sqlalchemy.future import select

from app.models import Generation, StyleProfile, CostLog, User, UserResume
from app.schemas.research import ResearchResult
from app.services.research import cascading_search
from app.services.vector import vector_service
from app.core.crypto import decrypt

from app.services.pipeline.deps import PipelineDeps
from app.services.pipeline.state import GraphState, ExtractedPattern, GeneratedDrafts, QualityVerdict
from app.services.pipeline.prompts import build_pattern_prompt, build_draft_prompt, build_quality_prompt

logger = logging.getLogger(__name__)

# Constants for cost logging
PRICE_PER_1M_PROMPT_TOKENS = 0.30
PRICE_PER_1M_COMPLETION_TOKENS = 2.50
MAX_RETRIES = 2

async def log_cost(deps: PipelineDeps, operation: str, raw_message, generation_id: str):
    """Logs the cost of an LLM call to the DB."""
    usage = getattr(raw_message, "usage_metadata", None)
    if not usage:
        return

    prompt_tokens = usage.get("input_tokens", 0)
    completion_tokens = usage.get("output_tokens", 0)
    cost = (
        (prompt_tokens / 1_000_000 * PRICE_PER_1M_PROMPT_TOKENS)
        + (completion_tokens / 1_000_000 * PRICE_PER_1M_COMPLETION_TOKENS)
    )

    gen_id = uuid.UUID(str(generation_id)) if generation_id else None
    cost_log = CostLog(
        generation_id=gen_id,
        operation=operation,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        estimated_cost_usd=cost,
    )
    deps.session.add(cost_log)
    # Commit is deferred until save_generation

def check_originality(draft: str, snippets: list[str]) -> tuple[bool, str]:
    """Checks for 6-word overlaps between the draft and any source snippets."""
    def get_ngrams(text: str, n: int = 6):
        words = text.lower().split()
        return set(tuple(words[i:i+n]) for i in range(len(words)-n+1))

    draft_ngrams = get_ngrams(draft)
    if not draft_ngrams:
        return True, ""

    for snippet in snippets:
        snippet_ngrams = get_ngrams(snippet)
        overlap = draft_ngrams.intersection(snippet_ngrams)
        if overlap:
            matched_phrase = " ".join(list(overlap)[0])
            return False, f"Plagiarism detected. 6+ word match: '{matched_phrase}'"

    return True, ""

async def node_research(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info("Executing node_research")
    try:
        result = await cascading_search(
            state["topic"], state["platform"], deps.session
        )
    except Exception as e:
        logger.error(f"Research failed: {e}", exc_info=True)
        return {"error": str(e), "research_result": None, "skip_extraction": False}

    skip = False
    if result and result.source == "cache":
        stmt = (
            select(StyleProfile)
            .where(
                StyleProfile.user_id == uuid.UUID(str(state["user_id"])),
                StyleProfile.platform == state["platform"],
            )
            .order_by(StyleProfile.id.desc())
            .limit(1)
        )
        res = await deps.session.execute(stmt)
        recent_profile = res.scalars().first()
        if recent_profile:
            logger.info("Cache hit + recent profile found. Skipping pattern extraction.")
            skip = True
            extracted = ExtractedPattern(
                structure=recent_profile.structure,
                tone=recent_profile.tone,
                pacing=recent_profile.pacing,
                storytelling_technique=recent_profile.storytelling_technique,
                formatting=recent_profile.formatting,
                cta_style=recent_profile.cta_style,
            )
            return {
                "research_result": result,
                "skip_extraction": True,
                "extracted_pattern": extracted,
            }

    return {"research_result": result, "skip_extraction": False}


async def node_pattern_extraction(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info("Executing node_pattern_extraction")
    if not deps.llm:
        return {"error": "Gemini API key missing"}

    snippets_text = "\n\n---\n\n".join(
        state["research_result"].content_snippets
        if state["research_result"]
        else []
    )

    historical_bias = _build_temporal_style_bias(state["user_id"], state["platform"])

    prompt = build_pattern_prompt(state, historical_bias, snippets_text)
    structured_llm = deps.llm.with_structured_output(ExtractedPattern, include_raw=True)

    try:
        response = await structured_llm.ainvoke(prompt)
        extracted = response["parsed"]
        raw_msg = response["raw"]
        await log_cost(deps, "pattern_extraction", raw_msg, state["generation_id"])
    except Exception as e:
        logger.warning(f"Structured extraction failed: {e}. Using default scaffold.")
        extracted = ExtractedPattern(
            structure="Standard hook and body",
            tone="Professional",
            pacing="Moderate",
            storytelling_technique="Direct",
            formatting="Standard",
            cta_style="Question",
        )

    profile = StyleProfile(
        user_id=uuid.UUID(str(state["user_id"])),
        platform=state["platform"],
        structure=extracted.structure,
        tone=extracted.tone,
        pacing=extracted.pacing,
        storytelling_technique=extracted.storytelling_technique,
        formatting=extracted.formatting,
        cta_style=extracted.cta_style,
    )
    deps.session.add(profile)
    await deps.session.commit()
    await deps.session.refresh(profile)

    style_concat = (
        f"Structure: {extracted.structure} | Tone: {extracted.tone} | "
        f"Pacing: {extracted.pacing} | Storytelling: {extracted.storytelling_technique} | "
        f"Format: {extracted.formatting} | CTA: {extracted.cta_style}"
    )
    vector_service.save_style_profile(
        str(profile.id), state["user_id"], state["platform"], style_concat
    )

    # Cleanup: keep only the last 10 style profiles per user+platform
    await _cleanup_old_style_profiles(deps, state["user_id"], state["platform"])

    return {"extracted_pattern": extracted}


def _build_temporal_style_bias(user_id: str, platform: str) -> str:
    """
    Builds a recency-weighted historical style context from the last 3-5 style profiles.
    Most recent gets the highest weight, older ones get progressively less.
    Falls back to single profile if fewer than 2 exist.
    """
    import logging
    log = logging.getLogger(__name__)

    recent = vector_service.get_recent_profiles(user_id, platform, limit=5)
    if not recent:
        return ""

    if len(recent) == 1:
        # Only one profile — use it directly, no weighting needed
        return (
            f"\nHere is the user's historical preferred style:\n{recent[0]['text']}\n"
            "Bias and blend your extraction towards this historical style where appropriate."
        )

    # Build weighted sections
    weights = ["(weight heavily — most recent):", "(weight lightly):", "(weight very lightly):"]
    parts = []
    for i, entry in enumerate(recent):
        weight_label = weights[min(i, len(weights) - 1)]
        parts.append(f"{weight_label}\n{entry['text']}")

    combined = "\n\n".join(parts)
    log.info(f"Injected temporal style bias from {len(recent)} recent profiles.")
    return (
        f"\nHere is the user's historical preferred style (temporal blend):\n{combined}\n"
        "Bias and blend your extraction towards the most recent style while honoring recurring patterns "
        "across the older profiles. Recent preferences should take precedence over older ones."
    )


async def _cleanup_old_style_profiles(deps: PipelineDeps, user_id: str, platform: str, keep: int = 10) -> None:
    """
    Deletes all but the newest `keep` StyleProfile rows for a user+platform in PostgreSQL,
    and mirrors the deletion in ChromaDB via vector_service.
    """
    import logging
    log = logging.getLogger(__name__)

    stmt = (
        select(StyleProfile)
        .where(
            StyleProfile.user_id == uuid.UUID(user_id),
            StyleProfile.platform == platform,
        )
        .order_by(StyleProfile.id.desc())
    )
    res = await deps.session.execute(stmt)
    all_profiles = res.scalars().all()

    if len(all_profiles) <= keep:
        return

    to_delete = all_profiles[keep:]
    to_delete_ids = [p.id for p in to_delete]
    to_delete_str_ids = [str(p.id) for p in to_delete]

    for profile in to_delete:
        await deps.session.delete(profile)
    await deps.session.commit()

    log.info(f"Cleaned up {len(to_delete)} old StyleProfile rows from DB (kept {keep}).")

    # Mirror deletion in ChromaDB
    deleted = vector_service.delete_oldest_profiles(user_id, platform, keep=keep)
    log.info(f"Mirrored cleanup in ChromaDB: deleted {deleted} entries.")


async def _build_background_context(deps: PipelineDeps, user_id: str) -> str:
    """
    Builds a compact "background context" block from the user's optional resume
    and about_me. Returns an empty string if the user has neither set.

    Reads the DB fresh on every call so that resume deletions or about_me
    edits take effect on the very next generation, not on a later one.
    """
    user_uuid = uuid.UUID(user_id)
    user_stmt = select(User).where(User.id == user_uuid)
    user_res = await deps.session.execute(user_stmt)
    user = user_res.scalars().first()

    resume_stmt = select(UserResume).where(UserResume.user_id == user_uuid)
    resume_res = await deps.session.execute(resume_stmt)
    resume = resume_res.scalars().first()

    if not user and not resume:
        return ""

    parts: list[str] = ["BACKGROUND CONTEXT (about the author — use to inform substance and specificity):"]

    # Resume summary (encrypted at rest — decrypt before use)
    if resume and resume.structured_summary:
        try:
            summary = json.loads(decrypt(resume.structured_summary))
        except (json.JSONDecodeError, Exception):
            summary = {}
        if summary:
            bits = []
            if summary.get("role"):
                bits.append(f"Role: {summary['role']}")
            if summary.get("past_employer"):
                bits.append(f"Employer: {summary['past_employer']}")
            if summary.get("industry"):
                bits.append(f"Industry: {summary['industry']}")
            if summary.get("experience_level"):
                bits.append(f"Experience: {summary['experience_level']}")
            expertise = summary.get("expertise_areas") or []
            if expertise:
                bits.append(f"Expertise: {', '.join(expertise)}")
            if summary.get("education"):
                bits.append(f"Education: {summary['education']}")
            if bits:
                parts.append("Resume-derived: " + " | ".join(bits))

    # About me (free text)
    if user and user.about_me and user.about_me.strip():
        parts.append(f"About the author: {user.about_me.strip()}")

    if len(parts) == 1:
        # No content was actually added
        return ""

    return "\n".join(parts)


async def node_draft_generation(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info(f"Executing node_draft_generation (Retry: {state.get('retry_count', 0)})")
    if not deps.llm:
        return {"error": "Gemini API key missing"}

    pattern = state["extracted_pattern"]
    if not pattern:
        return {"error": "No extracted pattern available for draft generation."}

    snippets_text = "\n\n---\n\n".join(
        state["research_result"].content_snippets if state["research_result"] else []
    )

    # Inject optional background context (resume + about_me) at the top of snippets_text
    # so it sits alongside research. Read fresh on every attempt — deletes take effect immediately.
    # Gate on use_context flag from the generation request.
    if state.get("use_context", True):
        background_context = await _build_background_context(deps, state["user_id"])
        if background_context:
            snippets_text = background_context + "\n\n---\n\n" + snippets_text

    # Inject structured feedback from the quality_check node on retry.
    # quality_feedback is the canonical cross-node channel; quality_results is
    # only surfaced to the API layer and should not be used for prompt injection here.
    feedback_injection = ""
    if state.get("retry_count", 0) > 0 and state.get("quality_feedback"):
        feedback_injection = (
            f"\n\nCRITICAL FEEDBACK FROM PREVIOUS ATTEMPT:\n"
            f"{state['quality_feedback']}\n"
            f"You MUST fix these issues in your new drafts."
        )
        snippets_text += feedback_injection

    prompt = build_draft_prompt(state, pattern, snippets_text)
    structured_llm = deps.llm.with_structured_output(GeneratedDrafts, include_raw=True)

    try:
        response = await structured_llm.ainvoke(prompt)
        drafts = response["parsed"]
        raw_msg = response["raw"]
        await log_cost(deps, "draft_generation", raw_msg, state["generation_id"])
        return {"drafts": drafts}
    except Exception as e:
        logger.error(f"Failed to generate drafts: {e}", exc_info=True)
        return {"error": f"Failed to generate drafts: {e}"}


async def node_quality_check(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info("Executing node_quality_check")
    if not state.get("drafts"):
        return {"quality_results": "FAIL: No drafts to check."}

    snippets = (
        state["research_result"].content_snippets
        if state.get("research_result")
        else []
    )
    drafts_obj = state["drafts"]
    drafts_list = [drafts_obj.draft_1, drafts_obj.draft_2, drafts_obj.draft_3]

    # Gate 1: 6-word originality check against research snippets
    for i, draft in enumerate(drafts_list):
        is_original, reason = check_originality(draft, snippets)
        if not is_original:
            return {"quality_results": f"FAIL [originality]: Draft {i+1} failed — {reason}"}

    if not deps.llm:
        # Without LLM we can't assess substance, but originality already passed above
        return {"quality_results": "PASS"}

    prompt = build_quality_prompt(state, drafts_obj)
    structured_llm = deps.llm.with_structured_output(QualityVerdict, include_raw=True)

    try:
        response = await structured_llm.ainvoke(prompt)
        verdict: QualityVerdict = response["parsed"]
        raw_msg = response["raw"]
        await log_cost(deps, "quality_check", raw_msg, state["generation_id"])

        # Build the quality_results feedback string, including substance info
        fail_reason = None
        if not verdict.passed:
            fail_check = verdict.failed_check or "unknown"
            fail_reason = (
                f"FAIL [{fail_check}]: "
                f"{verdict.failed_drafts or 'No details provided.'}"
            )

        # Build a structured quality_feedback payload for the next draft_generation iteration.
        # This is the proper cross-node channel: written by quality_check, read by draft_generation.
        # Kept distinct from the per-attempt `quality_results` string so retries accumulate
        # distinct feedback rather than concatenating strings.
        feedback_parts: list[str] = []
        if fail_reason:
            feedback_parts.append(
                f"CRITICAL FEEDBACK FROM PREVIOUS ATTEMPT: {fail_reason}"
            )
        if verdict.substance_score is not None and verdict.substance_score < 5:
            feedback_parts.append(
                "SUBSTANCE FEEDBACK: Your drafts scored below 5/10 for substance/originality-of-thought. "
                "They read too generically / like AI filler. The prompt lacked specific numbers, "
                "concrete claims, or a clear point of view. On retry, inject more specific details, "
                "concrete examples, and a clear position the reader can disagree with. "
                "Rewrite with substance first, structure second."
            )
        quality_feedback = "\n".join(feedback_parts) if feedback_parts else ""

        result: dict = {
            "quality_results": fail_reason or "PASS",
            "quality_feedback": quality_feedback,
        }
        if verdict.substance_score is not None:
            result["substance_score"] = verdict.substance_score
        return result

    except Exception as e:
        logger.error(f"Quality check LLM call failed: {e}", exc_info=True)
        return {"quality_results": "PASS"}


async def node_increment_retry(state: GraphState, deps: PipelineDeps) -> dict:
    return {"retry_count": state.get("retry_count", 0) + 1}


async def node_save_generation(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info("Executing node_save_generation")
    gen_id = uuid.UUID(str(state["generation_id"]))
    stmt = select(Generation).where(Generation.id == gen_id)
    result = await deps.session.execute(stmt)
    generation = result.scalars().first()

    if generation:
        if state.get("drafts"):
            generation.draft_1 = state["drafts"].draft_1
            generation.draft_2 = state["drafts"].draft_2
            generation.draft_3 = state["drafts"].draft_3

            if (
                state.get("retry_count", 0) >= MAX_RETRIES
                and state.get("quality_results")
                and not state["quality_results"].startswith("PASS")
            ):
                generation.status = "needs_review"
            else:
                generation.status = "editing"

        if state.get("error"):
            generation.status = "failed"

        deps.session.add(generation)
        await deps.session.commit()
        logger.info("Generation saved successfully.")

    return {}
