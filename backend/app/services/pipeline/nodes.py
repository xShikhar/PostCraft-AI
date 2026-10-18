import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from sqlalchemy.future import select

from app.models import Generation, StyleProfile, CostLog, User, UserResume, Preference
from app.services.research import cascading_search
from app.services.vector import vector_service
from app.core.crypto import decrypt, encrypt, read_private

from app.services.pipeline.deps import PipelineDeps
from app.services.pipeline.state import GraphState, ExtractedPattern, GeneratedDrafts, QualityVerdict
from app.services.pipeline.prompts import build_pattern_prompt, build_draft_prompt, build_quality_prompt, BANNED_AI_TELLS
from app.services.pipeline.llm_utils import invoke_with_bounded_backoff
from app.services.pipeline.structural_checks import check_structural_tells
from app.services.pipeline.unsourced_numbers import check_unsourced_numbers
from app.services.pipeline.originality import check_originality
from app.services.pipeline.background_tasks import (
    run_in_background,
    bg_log_cost,
    bg_save_and_cleanup_style_profile,
)

logger = logging.getLogger(__name__)

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
    """Logs the cost of an LLM call to the DB in a background task with an isolated session."""
    p_tok, c_tok, _ = _extract_tokens(raw_message)
    if p_tok or c_tok:
        run_in_background(
            bg_log_cost(
                generation_id=str(generation_id) if generation_id else "",
                operation=operation,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                model=(deps.settings.GEMINI_DRAFT_MODEL or deps.settings.GEMINI_MODEL) if operation in ("draft_generation", "edit") else (deps.settings.GEMINI_FAST_MODEL or deps.settings.GEMINI_MODEL),
            ),
            task_name=f"bg_log_cost_{operation}",
        )


async def node_research(state: GraphState, deps: PipelineDeps) -> dict:
    logger.info("Executing node_research")
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "research"):
        try:
            result = await cascading_search(
                state["topic"], state["platform"], deps.session, telemetry=telemetry
            )
        except Exception as e:
            logger.error(f"Research failed: {type(e).__name__}", exc_info=False)
            return {"error": "Research service unavailable", "research_result": None, "skip_extraction": False}

        if result and result.source == "cache":
            t0 = time.perf_counter()
            stmt = (
                select(StyleProfile)
                .where(
                    StyleProfile.user_id == uuid.UUID(str(state["user_id"])),
                    StyleProfile.platform == state["platform"],
                )
                .order_by(StyleProfile.created_at.desc(), StyleProfile.id.desc())
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
                _build_temporal_style_bias(deps, state["user_id"], state["platform"]),
                timeout=3.0,
            )
        except Exception as e:
            logger.warning(f"Could not load temporal style bias (non-fatal): {type(e).__name__}")
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
            response = await invoke_with_bounded_backoff(
                structured_llm.ainvoke,
                prompt,
                telemetry=telemetry,
                node_name="pattern_extraction",
            )
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
                    target="gemini_result",
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
            logger.warning(f"Structured extraction failed: {type(e).__name__}. Using default scaffold.")
            if telemetry:
                telemetry.record_call(
                    node_name="pattern_extraction",
                    target="gemini_result",
                    operation="pattern_extraction",
                    duration_s=t_llm,
                    status="error",
                    error_message=type(e).__name__,
                )
            extracted = ExtractedPattern(
                structure="Standard hook and body",
                tone="Professional",
                pacing="Moderate",
                storytelling_technique="Direct",
                formatting="Standard",
                cta_style="Question",
            )

        # Offload style profile Postgres save, Chroma vector store write, and cleanup to background worker
        try:
            run_in_background(
                bg_save_and_cleanup_style_profile(
                    generation_id=str(state.get("generation_id", "")),
                    user_id=str(state["user_id"]),
                    platform=state["platform"],
                    extracted_dict={
                        "structure": extracted.structure,
                        "tone": extracted.tone,
                        "pacing": extracted.pacing,
                        "storytelling_technique": extracted.storytelling_technique,
                        "formatting": extracted.formatting,
                        "cta_style": extracted.cta_style,
                    },
                ),
                task_name="bg_save_and_cleanup_style_profile",
            )
        except Exception as e:
            logger.warning(f"Could not schedule background style profile write: {type(e).__name__}")

        return {"extracted_pattern": extracted}


async def _build_temporal_style_bias(deps: PipelineDeps, user_id: str, platform: str) -> str:
    """
    Builds a recency-weighted historical style context from the last 3-5 style profiles.
    Most recent gets the highest weight, older ones get progressively less.
    If ChromaDB is empty (e.g. after container restart on Render free tier), queries
    PostgreSQL StyleProfile table as resilient fallback and re-seeds ChromaDB.
    """
    try:
        recent = await asyncio.wait_for(asyncio.to_thread(vector_service.get_recent_profiles, str(user_id), platform, limit=5), timeout=1.0)
    except Exception:
        recent = []
    if not recent:
        stmt = select(StyleProfile).where(StyleProfile.user_id == uuid.UUID(str(user_id)), StyleProfile.platform == platform).order_by(StyleProfile.created_at.desc(), StyleProfile.id.desc()).limit(5)
        profiles = (await deps.session.execute(stmt)).scalars().all()
        recent = [{"id": str(p.id), "text": " | ".join(f"{key}: {getattr(p, key) or ''}" for key in ExtractedPattern.model_fields), "created_at": p.created_at.isoformat()} for p in profiles]

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
            logger.warning(f"Failed to decrypt/parse resume summary: {type(e).__name__}")
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
    if user and user.about_me and read_private(user.about_me).strip():
        parts.append(f"About the author: {read_private(user.about_me).strip()}")

    # Additional professional background notes (free text)
    if user and user.profile_context and read_private(user.profile_context).strip():
        # Strip out writing_style marker if stored in combined profile_context
        clean_context = read_private(user.profile_context).split("[writing_style]")[0].strip().rstrip("-").strip()
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

        background_context = ""
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
            failed_indices = state.get("failed_draft_indices", [])
            target_clause = ""
            if failed_indices and len(failed_indices) < 3:
                target_names = [f"Draft {idx+1}" for idx in failed_indices]
                target_clause = f"\nFocus rewrite specifically on: {', '.join(target_names)}. The other draft(s) passed all quality gates."
            feedback_injection = (
                f"\n\nCRITICAL FEEDBACK FROM PREVIOUS ATTEMPT:\n"
                f"{state['quality_feedback']}{target_clause}\n"
                f"You MUST fix these issues in your regenerated drafts."
            )
            snippets_text += feedback_injection

        preferences = (await deps.session.execute(select(Preference).where(Preference.user_id == uuid.UUID(str(state["user_id"])), Preference.platform == state["platform"]).order_by(Preference.created_at.desc(), Preference.id.desc()).limit(5))).scalars().all()
        learned = "\n".join(read_private(p.preference_text) for p in preferences)
        prompt = build_draft_prompt(state, pattern, snippets_text)
        prompt += "\nWRITING STYLE INSTRUCTIONS (never evidence for personal claims):\n" + (state.get("writing_style") or "") + "\nLEARNED STYLE PREFERENCES (newest first):\n" + learned
        state["factual_context"] = background_context
        targets = state.get("failed_draft_indices") or [0, 1, 2]
        schema = GeneratedDrafts
        if retry_count and len(targets) < 3:
            from pydantic import create_model
            schema = create_model("TargetedDrafts", **{f"draft_{i+1}": (str, ...) for i in targets})
            prompt += "\nOVERRIDE: Return ONLY these fields, regenerating only these drafts: " + ", ".join(f"draft_{i+1}" for i in targets)
        draft_model = deps.draft_llm or deps.llm
        structured_llm = draft_model.with_structured_output(schema, include_raw=True)

        t0 = time.perf_counter()
        try:
            response = await invoke_with_bounded_backoff(
                structured_llm.ainvoke,
                prompt,
                telemetry=telemetry,
                node_name="draft_generation",
            )
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
                    target="gemini_result",
                    operation="generate_drafts",
                    duration_s=t_llm,
                    prompt_tokens=p_tok,
                    completion_tokens=c_tok,
                    reasoning_tokens=r_tok,
                )
            if raw_msg:
                await log_cost(deps, "draft_generation", raw_msg, state["generation_id"])

            if drafts is None:
                raise ValueError("Draft response could not be parsed")
            if retry_count and state.get("drafts"):
                previous = state["drafts"].model_dump()
                previous.update(drafts.model_dump())
                drafts = GeneratedDrafts(**previous)
            return {"drafts": drafts, "factual_context": background_context}
        except Exception as e:
            t_llm = time.perf_counter() - t0
            logger.error(f"Failed to generate drafts: {type(e).__name__}", exc_info=False)
            if telemetry:
                telemetry.record_call(
                    node_name="draft_generation",
                    target="gemini_result",
                    operation="generate_drafts",
                    duration_s=t_llm,
                    status="error",
                    error_message=type(e).__name__,
                )
            return {"error": "Draft generation unavailable. Please try again."}


def _quality_result(message, hard=False, indices=None, score=None):
    return {"quality_results": message, "is_hard_failure": hard,
            "failed_draft_indices": indices or [], "quality_feedback": "" if message == "PASS" else message,
            "substance_score": score}


async def node_quality_check(state: GraphState, deps: PipelineDeps) -> dict:
    telemetry = state.get("telemetry")
    async with _measure_node_ctx(telemetry, "quality_check", retry_count=state.get("retry_count", 0)):
        drafts = state.get("drafts")
        if not drafts:
            return _quality_result("FAIL: No drafts to evaluate")
        research = state.get("research_result")
        snippets = research.content_snippets if research else []
        source = research.source if research else None
        background = await _build_background_context(deps, state["user_id"]) if state.get("use_context", True) else ""
        state["factual_context"] = background
        author_sources = [state.get("topic", ""), state.get("raw_thoughts", ""), state.get("profile_context", ""), background]
        failures = []
        warning_indices = []
        indices = []
        import re
        for i, draft in enumerate(drafts.model_dump().values()):
            checks = [check_originality(draft, snippets, research_source=source), check_structural_tells(draft)]
            numbers_ok, reason, warnings = check_unsourced_numbers(draft, author_sources, snippets if source != "synthetic_structure" else [])
            checks.append((numbers_ok, reason))
            if warnings:
                warning_indices.append(i+1)
            if any(re.search(r"\b" + re.escape(phrase) + r"\b", draft, re.I) for phrase in BANNED_AI_TELLS):
                checks.append((False, "banned_phrases"))
            if not draft.strip():
                checks.append((False, "empty draft"))
            failed = [reason for ok, reason in checks if not ok]
            if failed:
                indices.append(i)
                # Feedback is private pipeline state; do not log excerpts.
                failures.append(f"Draft {i+1}: " + "; ".join(failed))
        if failures:
            return _quality_result("FAIL: " + " | ".join(failures), True, indices)
        if warning_indices:
            return _quality_result("FAIL [grounding]: Review unsupported numeric thresholds in drafts " + ", ".join(map(str, warning_indices)))
        if not deps.llm:
            return _quality_result("FAIL: Quality judge unavailable; manual review required")
        try:
            judge = deps.llm.with_structured_output(QualityVerdict, include_raw=True)
            response = await invoke_with_bounded_backoff(judge.ainvoke, build_quality_prompt(state, drafts), telemetry=telemetry, node_name="quality_check")
            verdict = response.get("parsed") if isinstance(response, dict) else response
            raw = response.get("raw") if isinstance(response, dict) else None
            if verdict is None:
                raise ValueError("Unparseable quality verdict")
            if raw:
                await log_cost(deps, "quality_check", raw, state["generation_id"])
            score = verdict.substance_score
            if not verdict.passed or score is None or score < 7:
                hard = verdict.failed_check in ("banned_phrases", "grounding")
                return _quality_result(f"FAIL [{verdict.failed_check or 'substance'}]: {verdict.failed_drafts or 'Substance score below 7 or unavailable'}", hard, [0, 1, 2] if hard else [], score)
            return _quality_result("PASS", score=score)
        except Exception:
            logger.warning("Quality judge unavailable; generation needs review")
            return _quality_result("FAIL: Quality evaluation unavailable; manual review required")


async def node_increment_retry(state: GraphState, deps: PipelineDeps) -> dict:
    async with _measure_node_ctx(state.get("telemetry"), "increment_retry"):
        if state.get("telemetry"):
            state["telemetry"].retry_loops_taken += 1
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
                if not generation.original_drafts:
                    generation.original_drafts = state["drafts"].model_dump()
                generation.draft_1 = state["drafts"].draft_1
                generation.draft_2 = state["drafts"].draft_2
                generation.draft_3 = state["drafts"].draft_3

                qr = state.get("quality_results") or ""
                if qr and not qr.startswith("PASS"):
                    generation.status = "needs_review"
                else:
                    generation.status = "editing"

            if state.get("error"):
                generation.status = "failed"

            generation.context_snapshot = encrypt(json.dumps({"profile": state.get("profile_context") or "", "use_context": state.get("use_context", True)}))
            research = state.get("research_result")
            generation.research_data = research.model_dump() if research else None
            generation.quality_data = {"result": state.get("quality_results"), "substance_score": state.get("substance_score")}
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
