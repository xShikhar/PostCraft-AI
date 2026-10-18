import os
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
import httpx

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import ResearchCache
from app.schemas.research import ResearchResult, SourceItem
from app.core.config import get_settings, Settings

logger = logging.getLogger(__name__)

def load_creators(platform: str) -> List[str]:
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "creators", f"{platform.lower()}.json")
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
            return data.get("creators", [])
    except FileNotFoundError:
        logger.warning(f"Creators config not found for {platform}")
        return []

async def _check_cache(topic: str, platform: str, session: AsyncSession) -> Optional[ResearchResult]:
    stmt = select(ResearchCache).where(
        ResearchCache.topic == hashlib.sha256(topic.encode()).hexdigest(),
        ResearchCache.platform == platform,
        ResearchCache.expires_at > datetime.now(timezone.utc)
    )
    result = await session.execute(stmt)
    cache_entry = result.scalars().first()
    
    if cache_entry:
        data = json.loads(cache_entry.results_json)
        if isinstance(data, dict) and data.get("source") != "synthetic_structure":
            return ResearchResult(topic=topic, platform=platform, **data)
    return None

async def _search_tavily(query: str, api_key: str) -> tuple[List[str], List[SourceItem]]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "search_depth": "basic",
                "include_answer": False,
                "include_raw_content": True,
                "max_results": 5,
            },
            timeout=15.0
        )
        if response.status_code == 200:
            data = response.json()
            snippets = []
            sources = []
            for r in data.get("results", []):
                raw = (r.get("raw_content") or "").strip()
                summary = (r.get("content") or "").strip()
                # Cap raw content per result to 1,500 chars to avoid 100k+ token prompt bloat and 429 quota exhaustion
                content = (raw or summary)[:1500].strip()
                if content:
                    snippets.append(content)
                    sources.append(SourceItem(
                        title=r.get("title", ""),
                        snippet=summary[:200] if summary else content[:200],
                        url=r.get("url", "")
                    ))
            return snippets, sources
        else:
            logger.error(f"Tavily search failed: {response.status_code}")
            return [], []

async def _search_serp_api(query: str, api_key: str) -> tuple[List[str], List[SourceItem]]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://serpapi.com/search",
            params={
                "q": query,
                "api_key": api_key,
                "engine": "google"
            },
            timeout=15.0
        )
        if response.status_code == 200:
            data = response.json()
            snippets = []
            sources = []
            for r in data.get("organic_results", [])[:5]:
                snippet = r.get("snippet") or r.get("title", "")
                if snippet:
                    snippets.append(snippet)
                    sources.append(SourceItem(
                        title=r.get("title", ""),
                        snippet=snippet[:200],
                        url=r.get("link", "")
                    ))
            return snippets, sources
        else:
            logger.error(f"SerpApi search failed: {response.status_code}")
            return [], []

async def _perform_search(query: str, settings) -> tuple[List[str], List[SourceItem]]:
    for search, key in ((_search_tavily, settings.TAVILY_API_KEY), (_search_serp_api, settings.SERP_API_KEY)):
        if not key:
            continue
        try:
            snippets, sources = await search(query, key)
            if snippets:
                return snippets, sources
        except httpx.HTTPError:
            logger.warning("Research provider unavailable; trying next provider")
    return [], []


async def _generate_synthetic_structure(topic: str, platform: str, settings, telemetry=None) -> tuple[List[str], int, int, int]:
    if not settings.GEMINI_API_KEY:
        logger.warning("No Gemini API Key found for fallback.")
        return [], 0, 0, 0
    
    from app.services.pipeline.llm_utils import create_gemini_client, invoke_with_bounded_backoff

    client = create_gemini_client(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        max_retries=0,
        timeout=60.0,
    )
    prompt = (
        f"Provide 3 distinct examples of high-quality structural patterns for {platform} posts about '{topic}'. "
        "Return fictional STRUCTURE ONLY with bracketed placeholders. Never invent statistics, personal anecdotes, credentials or events. These are not factual research."
    )
    
    try:
        t0 = time.perf_counter()
        response = await invoke_with_bounded_backoff(
            client.ainvoke,
            prompt,
            telemetry=telemetry,
            node_name="research",
        )
        t_call = time.perf_counter() - t0
        usage = getattr(response, "usage_metadata", None) or {}
        p_tok = usage.get("input_tokens", 0)
        c_tok = usage.get("output_tokens", 0)
        r_tok = (usage.get("output_token_details") or {}).get("reasoning", 0)
        if telemetry:
            telemetry.record_call(
                node_name="research",
                target="gemini_result",
                operation="synthetic_structure",
                duration_s=t_call,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                reasoning_tokens=r_tok,
            )
        if response.content:
            return [str(response.content)], p_tok, c_tok, r_tok
    except Exception as e:
        logger.error(f"Fallback generation failed: {type(e).__name__}")
        if telemetry:
            telemetry.record_call(
                node_name="research",
                target="gemini_result",
                operation="synthetic_structure",
                duration_s=0.0,
                status="error",
                error_message=type(e).__name__,
            )
        
    return [], 0, 0, 0


async def cascading_search(topic: str, platform: str, session: AsyncSession, telemetry=None) -> ResearchResult:
    settings = get_settings()
    
    # 1. Check Cache
    t0 = time.perf_counter()
    cached_result = await _check_cache(topic, platform, session)
    t_cache = time.perf_counter() - t0
    if telemetry:
        telemetry.record_call(
            node_name="research",
            target="postgres",
            operation="cache_check",
            duration_s=t_cache,
        )
    if cached_result:
        return cached_result

    has_search_keys = bool(settings.TAVILY_API_KEY or settings.SERP_API_KEY)
    
    snippets = []
    sources = []
    source = None
    confidence = "low"

    if has_search_keys:
        # 2. Curated Search
        creators = load_creators(platform)
        if creators:
            site_modifier = "site:linkedin.com/in/" if platform.lower() == "linkedin" else "site:x.com/"
            creator_query = " OR ".join([f"{site_modifier}{c.replace(' ', '').lower()}" for c in creators[:3]])
            query = f"{topic} ({creator_query})"
            t0 = time.perf_counter()
            snippets, sources = await _perform_search(query, settings)
            t_search = time.perf_counter() - t0
            if telemetry:
                telemetry.record_call(
                    node_name="research",
                    target="tavily" if settings.TAVILY_API_KEY else "serpapi",
                    operation="curated_search",
                    duration_s=t_search,
                )
            if snippets:
                source = "curated_search"
                confidence = "high"
        
        # 3. General Search Fallback
        if not snippets:
            query = f"{topic} {platform} post examples"
            t0 = time.perf_counter()
            snippets, sources = await _perform_search(query, settings)
            t_search = time.perf_counter() - t0
            if telemetry:
                telemetry.record_call(
                    node_name="research",
                    target="tavily" if settings.TAVILY_API_KEY else "serpapi",
                    operation="general_search",
                    duration_s=t_search,
                )
            if snippets:
                source = "general_search"
                confidence = "medium"

    # 4. Model Synthetic Structure
    if not snippets:
        synth_snippets, synth_prompt, synth_completion, _ = await _generate_synthetic_structure(topic, platform, settings, telemetry=telemetry)
        snippets = synth_snippets
        if telemetry and (synth_prompt or synth_completion):
            from app.services.pipeline.background_tasks import run_in_background, bg_log_cost
            run_in_background(bg_log_cost(str(telemetry.generation_id), "synthetic_structure", synth_prompt, synth_completion, model=settings.GEMINI_MODEL))
        sources = []  # No URLs for synthetic content
        if snippets:
            source = "synthetic_structure"
            confidence = "low"

    # Save to Cache if we got something (in background, off hot path)
    if snippets and source and source != "synthetic_structure":
        try:
            from app.services.pipeline.background_tasks import run_in_background, bg_save_research_cache
            run_in_background(
                bg_save_research_cache(
                    generation_id=telemetry.generation_id if telemetry else None,
                    topic=topic,
                    platform=platform,
                    snippets=snippets,
                    sources=[item.model_dump() for item in sources],
                    source=source, confidence=confidence,
                ),
                task_name="bg_save_research_cache",
            )
        except Exception as e:
            logger.warning(f"Could not schedule background research cache write: {type(e).__name__}")

        return ResearchResult(
            topic=topic,
            platform=platform,
            content_snippets=snippets,
            sources=sources,
            confidence=confidence,
            source=source
        )

    if snippets:
        return ResearchResult(topic=topic, platform=platform, content_snippets=snippets, sources=sources, confidence=confidence, source=source)

    # Absolute ultimate failure
    return ResearchResult(
        topic=topic,
        platform=platform,
        content_snippets=["No data could be retrieved from search or model."],
        sources=[],
        confidence="low",
        source="synthetic_structure"
    )
