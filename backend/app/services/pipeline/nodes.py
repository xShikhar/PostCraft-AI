import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from sqlalchemy.future import select

from app.models import Generation, StyleProfile, CostLog, User, UserResume
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

@asynccontextmanager
async def _measure_node_ctx(telemetry, node_name: str, retry_count: int = 0):
    if telemetry:
        async with telemetry.measure_node(node_name, retry_count=retry_count) as m:
            yield m
    else:
        yield None

def _extract_tokens(raw_msg):
    usage = getattr(raw_msg, "usage_metadata", None) or {}
    p_tok = usage.get("input_tokens", 0)
    c_tok = usage.get("output_tokens", 0)
    details = usage.get("output_token_details") or {}
    r_tok = details.get("reasoning", 0) or details.get("reasoning_tokens", 0)
    return p_tok, c_tok, r_tok

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
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "research"):
        try:
            result = await cascading_search(
                state["topic"], state["platform"], deps.session, telemetry=telemetry
            )
        except Exception as e:
            logger.error(f"Research failed: {e}", exc_info=True)
            return {"error": str(e), "research_result": None, "skip_extraction": False}

        if result and result.source == "cache":
            t0 = time.perf_counter()
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
            if telemetry:
                telemetry.record_call(
                    node_name="research",
                    target="postgres",
                    operation="lookup_recent_profile",
                    duration_s=time.perf_counter() - t0,
                )
            if recent_profile:
                logger.info("Cache hit + recent profile found. Skipping pattern extraction.")
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
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "pattern_extraction"):
        if not deps.llm:
            return {"error": "Gemini API key missing"}

        snippets_text = "\n\n---\n\n".join(
            state["research_result"].content_snippets
            if state["research_result"]
            else []
        )

        t0 = time.perf_counter()
        try:
            historical_bias = await asyncio.wait_for(
                asyncio.to_thread(_build_temporal_style_bias, state["user_id"], state["platform"]),
                timeout=3.0,
            )
        except Exception as e:
            logger.warning(f"Could not load temporal style bias (non-fatal): {e}")
            historical_bias = ""
        if telemetry:
            telemetry.record_call(
                node_name="pattern_extraction",
                target="chromadb",
                operation="get_recent_profiles",
                duration_s=time.perf_counter() - t0,
            )

        prompt = build_pattern_prompt(state, historical_bias, snippets_text)
        structured_llm = deps.llm.with_structured_output(ExtractedPattern, include_raw=True)

        t0 = time.perf_counter()
        try:
            response = await structured_llm.ainvoke(prompt)
            t_llm = time.perf_counter() - t0
            if isinstance(response, dict):
                extracted = response.get("parsed")
                raw_msg = response.get("raw")
            else:
                extracted = response
                raw_msg = None
            p_tok, c_tok, r_tok = _extract_tokens(raw_msg)
            if telemetry:
                telemetry.record_call(
                    node_name="pattern_extraction",
                    target="gemini",
                    operation="pattern_extraction",
                    duration_s=t_llm,
                    prompt_tokens=p_tok,
                    completion_tokens=c_tok,
                    reasoning_tokens=r_tok,
                )
            if raw_msg:
                await log_cost(deps, "pattern_extraction", raw_msg, state["generation_id"])
        except Exception as e:
            t_llm = time.perf_counter() - t0
            logger.warning(f"Structured extraction failed: {e}. Using default scaffold.")
            if telemetry:
                telemetry.record_call(
                    node_name="pattern_extraction",
                    target="gemini",
                    operation="pattern_extraction",
                    duration_s=t_llm,
                    status="error",
                    error_message=str(e),
                )
            extracted = ExtractedPattern(
                structure="Standard hook and body",
                tone="Professional",
                pacing="Moderate",
                storytelling_technique="Direct",
                formatting="Standard",
                cta_style="Question",
            )

        t0 = time.perf_counter()
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
        if telemetry:
            telemetry.record_call(
                node_name="pattern_extraction",
                target="postgres",
                operation="save_style_profile",
                duration_s=time.perf_counter() - t0,
            )

        style_concat = (
            f"Structure: {extracted.structure} | Tone: {extracted.tone} | "
            f"Pacing: {extracted.pacing} | Storytelling: {extracted.storytelling_technique} | "
            f"Format: {extracted.formatting} | CTA: {extracted.cta_style}"
        )
        t0 = time.perf_counter()
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    vector_service.save_style_profile,
                    str(profile.id), state["user_id"], state["platform"], style_concat
                ),
                timeout=5.0,
            )
        except Exception as e:
            logger.warning(f"Could not save style profile to vector store (non-fatal): {e}")
        if telemetry:
            telemetry.record_call(
                node_name="pattern_extraction",
                target="chromadb",
                operation="save_vector_profile",
                duration_s=time.perf_counter() - t0,
            )

        t0 = time.perf_counter()
        await _cleanup_old_style_profiles(deps, state["user_id"], state["platform"])
        if telemetry:
            telemetry.record_call(
                node_name="pattern_extraction",
                target="chromadb",
                operation="cleanup_profiles",
                duration_s=time.perf_counter() - t0,
            )

        return {"extracted_pattern": extracted}


def _build_temporal_style_bias(user_id: str, platform: str) -> str:
    """
    Builds a recency-weighted historical style context from the last 3-5 style profiles.
    Most recent gets the highest weight, older ones get progressively less.
    Falls back to single profile if fewer than 2 exist.
    """

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
    logger.info(f"Injected temporal style bias from {len(recent)} recent profiles.")
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

    user_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    stmt = (
        select(StyleProfile)
        .where(
            StyleProfile.user_id == user_uuid,
            StyleProfile.platform == platform,
        )
        .order_by(StyleProfile.id.desc())
    )
    res = await deps.session.execute(stmt)
    all_profiles = res.scalars().all()

    if len(all_profiles) <= keep:
        return

    to_delete = all_profiles[keep:]

    for profile in to_delete:
        await deps.session.delete(profile)
    await deps.session.commit()

    logger.info(f"Cleaned up {len(to_delete)} old StyleProfile rows from DB (kept {keep}).")

    # Mirror deletion in ChromaDB
    try:
        deleted = await asyncio.wait_for(
            asyncio.to_thread(
                vector_service.delete_oldest_profiles,
                str(user_id), platform, keep=keep
            ),
            timeout=5.0,
        )
        logger.info(f"Mirrored cleanup in ChromaDB: deleted {deleted} entries.")
    except Exception as e:
        logger.warning(f"ChromaDB cleanup mirror failed (non-fatal): {e}")


async def _build_background_context(deps: PipelineDeps, user_id: str | uuid.UUID) -> str:
    """
    Builds a compact "background context" block from the user's optional resume
    and about_me. Returns an empty string if the user has neither set.

    Reads the DB fresh on every call so that resume deletions or about_me
    edits take effect on the very next generation, not on a later one.
    """
    user_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
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
        except (json.JSONDecodeError, ValueError) as e:
            # JSON parse failure OR Fernet decryption failure (InvalidToken is a ValueError).
            # Without this split, the original `except (json.JSONDecodeError, Exception)`
            # made the second branch dead code.
            logger.warning(f"Failed to decrypt/parse resume summary: {e}")
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

    # Additional professional background notes (free text)
    if user and user.profile_context and user.profile_context.strip():
        # Strip out writing_style marker if stored in combined profile_context
        clean_context = user.profile_context.split("[writing_style]")[0].strip().rstrip("-").strip()
        if clean_context:
            parts.append(f"Background notes: {clean_context}")

    if len(parts) == 1:
        # No content was actually added
        return ""

    return "\n".join(parts)


async def node_draft_generation(state: GraphState, deps: PipelineDeps) -> dict:
    retry_count = state.get("retry_count", 0)
    logger.info(f"Executing node_draft_generation (Retry: {retry_count})")
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "draft_generation", retry_count=retry_count):
        if not deps.llm:
            return {"error": "Gemini API key missing"}

        pattern = state["extracted_pattern"]
        if not pattern:
            return {"error": "No extracted pattern available for draft generation."}

        snippets_text = "\n\n---\n\n".join(
            state["research_result"].content_snippets if state["research_result"] else []
        )

        if state.get("use_context", True):
            t0 = time.perf_counter()
            background_context = await _build_background_context(deps, state["user_id"])
            if telemetry:
                telemetry.record_call(
                    node_name="draft_generation",
                    target="postgres",
                    operation="background_context",
                    duration_s=time.perf_counter() - t0,
                )
            if background_context:
                snippets_text = background_context + "\n\n---\n\n" + snippets_text

        feedback_injection = ""
        if retry_count > 0 and state.get("quality_feedback"):
            feedback_injection = (
                f"\n\nCRITICAL FEEDBACK FROM PREVIOUS ATTEMPT:\n"
                f"{state['quality_feedback']}\n"
                f"You MUST fix these issues in your new drafts."
            )
            snippets_text += feedback_injection

        prompt = build_draft_prompt(state, pattern, snippets_text)
        structured_llm = deps.llm.with_structured_output(GeneratedDrafts, include_raw=True)

        t0 = time.perf_counter()
        try:
            response = await structured_llm.ainvoke(prompt)
            t_llm = time.perf_counter() - t0
            if isinstance(response, dict):
                drafts = response.get("parsed")
                raw_msg = response.get("raw")
            else:
                drafts = response
                raw_msg = None
            p_tok, c_tok, r_tok = _extract_tokens(raw_msg)
            if telemetry:
                telemetry.record_call(
                    node_name="draft_generation",
                    target="gemini",
                    operation="generate_drafts",
                    duration_s=t_llm,
                    prompt_tokens=p_tok,
                    completion_tokens=c_tok,
                    reasoning_tokens=r_tok,
                )
            if raw_msg:
                await log_cost(deps, "draft_generation", raw_msg, state["generation_id"])
            return {"drafts": drafts}
        except Exception as e:
            t_llm = time.perf_counter() - t0
            logger.error(f"Failed to generate drafts: {e}", exc_info=True)
            if telemetry:
                telemetry.record_call(
                    node_name="draft_generation",
                    target="gemini",
                    operation="generate_drafts",
                    duration_s=t_llm,
                    status="error",
                    error_message=str(e),
                )
            return {"error": f"Failed to generate drafts: {e}"}


async def node_quality_check(state: GraphState, deps: PipelineDeps) -> dict:
    retry_count = state.get("retry_count", 0)
    logger.info("Executing node_quality_check")
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "quality_check", retry_count=retry_count) as metric:
        drafts_obj = state.get("drafts")
        if not drafts_obj:
            return {"quality_results": "FAIL: No drafts to check."}

        research = state.get("research_result")
        snippets = (
            research.content_snippets
            if research and hasattr(research, "content_snippets") and research.content_snippets
            else []
        )
        drafts_list = [
            getattr(drafts_obj, "draft_1", "") or "",
            getattr(drafts_obj, "draft_2", "") or "",
            getattr(drafts_obj, "draft_3", "") or "",
        ]

        # Gate 1: 6-word originality check against research snippets
        t0 = time.perf_counter()
        for i, draft in enumerate(drafts_list):
            is_original, reason = check_originality(draft, snippets)
            if not is_original:
                if telemetry:
                    telemetry.record_call(
                        node_name="quality_check",
                        target="python",
                        operation="check_originality",
                        duration_s=time.perf_counter() - t0,
                        status="fail",
                    )
                return {"quality_results": f"FAIL [originality]: Draft {i+1} failed — {reason}"}
        if telemetry:
            telemetry.record_call(
                node_name="quality_check",
                target="python",
                operation="check_originality",
                duration_s=time.perf_counter() - t0,
            )

        if not deps.llm:
            return {"quality_results": "PASS"}

        prompt = build_quality_prompt(state, drafts_obj)
        structured_llm = deps.llm.with_structured_output(QualityVerdict, include_raw=True)

        t0 = time.perf_counter()
        try:
            response = await structured_llm.ainvoke(prompt)
            t_llm = time.perf_counter() - t0
            if isinstance(response, dict):
                verdict: QualityVerdict = response.get("parsed")
                raw_msg = response.get("raw")
            else:
                verdict: QualityVerdict = response
                raw_msg = None
            p_tok, c_tok, r_tok = _extract_tokens(raw_msg)
            if telemetry:
                telemetry.record_call(
                    node_name="quality_check",
                    target="gemini",
                    operation="quality_verdict",
                    duration_s=t_llm,
                    prompt_tokens=p_tok,
                    completion_tokens=c_tok,
                    reasoning_tokens=r_tok,
                )
            if raw_msg:
                await log_cost(deps, "quality_check", raw_msg, state["generation_id"])

            if metric:
                metric.metadata["passed"] = verdict.passed
                metric.metadata["failed_check"] = verdict.failed_check
                metric.metadata["substance_score"] = verdict.substance_score

            fail_reason = None
            if not verdict.passed:
                fail_check = verdict.failed_check or "unknown"
                fail_reason = (
                    f"FAIL [{fail_check}]: "
                    f"{verdict.failed_drafts or 'No details provided.'}"
                )

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
            t_llm = time.perf_counter() - t0
            logger.error(f"Quality check LLM call failed: {e}", exc_info=True)
            if telemetry:
                telemetry.record_call(
                    node_name="quality_check",
                    target="gemini",
                    operation="quality_verdict",
                    duration_s=t_llm,
                    status="error",
                    error_message=str(e),
                )
            return {"quality_results": "PASS"}


async def node_increment_retry(state: GraphState, deps: PipelineDeps) -> dict:
    telemetry = state.get("telemetry")
    if telemetry:
        telemetry.retry_loops_taken += 1
    return {"retry_count": state.get("retry_count", 0) + 1}


async def node_save_generation(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info("Executing node_save_generation")
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "save_generation"):
        t0 = time.perf_counter()
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

        if telemetry:
            telemetry.record_call(
                node_name="save_generation",
                target="postgres",
                operation="save_generation",
                duration_s=time.perf_counter() - t0,
            )

    return {}
