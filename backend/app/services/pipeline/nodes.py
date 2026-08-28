import logging
import uuid
from sqlalchemy.future import select

from app.models import Generation, StyleProfile, CostLog
from app.schemas.research import ResearchResult
from app.services.research import cascading_search
from app.services.vector import vector_service

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

    historical_bias = ""
    past_style = vector_service.get_similar_profile(
        state["user_id"], state["platform"], snippets_text
    )
    if past_style:
        historical_bias = (
            f"\nHere is the user's historical preferred style:\n{past_style}\n"
            "Bias and blend your extraction towards this historical style where appropriate."
        )

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

    return {"extracted_pattern": extracted}


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

    feedback_injection = ""
    if state.get("retry_count", 0) > 0 and state.get("quality_results"):
        feedback_injection = f"""
        CRITICAL FEEDBACK FROM PREVIOUS ATTEMPT:
        Your previous drafts failed the quality check for this reason: {state['quality_results']}
        You MUST fix this in your new drafts.
        """
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

    for i, draft in enumerate(drafts_list):
        is_original, reason = check_originality(draft, snippets)
        if not is_original:
            return {"quality_results": f"FAIL [originality]: Draft {i+1} failed — {reason}"}

    if not deps.llm:
        return {"quality_results": "PASS"}

    prompt = build_quality_prompt(state, drafts_obj)
    structured_llm = deps.llm.with_structured_output(QualityVerdict, include_raw=True)

    try:
        response = await structured_llm.ainvoke(prompt)
        verdict: QualityVerdict = response["parsed"]
        raw_msg = response["raw"]
        await log_cost(deps, "quality_check", raw_msg, state["generation_id"])

        if verdict.passed:
            return {"quality_results": "PASS"}
        else:
            fail_reason = (
                f"FAIL [{verdict.failed_check or 'unknown'}]: "
                f"{verdict.failed_drafts or 'No details provided.'}"
            )
            return {"quality_results": fail_reason}
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
