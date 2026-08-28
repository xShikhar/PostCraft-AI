import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import httpx

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import ResearchCache
from app.schemas.research import ResearchResult, SourceItem
from app.core.config import get_settings

from langchain_google_genai import ChatGoogleGenerativeAI

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
        ResearchCache.topic == topic,
        ResearchCache.platform == platform,
        ResearchCache.expires_at > datetime.now(timezone.utc)
    )
    result = await session.execute(stmt)
    cache_entry = result.scalars().first()
    
    if cache_entry:
        snippets = json.loads(cache_entry.results_json)
        return ResearchResult(
            topic=topic,
            platform=platform,
            content_snippets=snippets,
            confidence="high", # Typically cached results are high/medium confidence
            source="cache"
        )
    return None

async def _save_cache(topic: str, platform: str, snippets: List[str], session: AsyncSession):
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    cache_entry = ResearchCache(
        topic=topic,
        platform=platform,
        results_json=json.dumps(snippets),
        expires_at=expires_at
    )
    session.add(cache_entry)
    await session.commit()

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
                content = r.get("raw_content") or r.get("content", "")
                if content:
                    snippets.append(content)
                    sources.append(SourceItem(
                        title=r.get("title", ""),
                        snippet=r.get("content", content[:200]),
                        url=r.get("url", "")
                    ))
            return snippets, sources
        else:
            logger.error(f"Tavily search failed: {response.text}")
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
            logger.error(f"SerpApi search failed: {response.text}")
            return [], []

async def _perform_search(query: str, settings) -> tuple[List[str], List[SourceItem]]:
    if settings.TAVILY_API_KEY:
        return await _search_tavily(query, settings.TAVILY_API_KEY)
    elif settings.SERP_API_KEY:
        return await _search_serp_api(query, settings.SERP_API_KEY)
    return [], []

async def _generate_synthetic_structure(topic: str, platform: str, settings) -> List[str]:
    if not settings.GEMINI_API_KEY:
        logger.warning("No Gemini API Key found for fallback.")
        return []
    
    client = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.GEMINI_API_KEY
    )
    prompt = (
        f"Provide 3 distinct examples of high-quality structural patterns for {platform} posts about '{topic}'. "
        "Do not provide advice, just provide the raw simulated post texts so we can analyze their structure, pacing, and formatting."
    )
    
    try:
        response = await client.ainvoke(prompt)
        if response.content:
            return [str(response.content)]
    except Exception as e:
        logger.error(f"Fallback generation failed: {e}")
        
    return []


async def cascading_search(topic: str, platform: str, session: AsyncSession) -> ResearchResult:
    settings = get_settings()
    
    # 1. Check Cache
    cached_result = await _check_cache(topic, platform, session)
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
            # Build a query biasing towards these creators
            site_modifier = "site:linkedin.com/in/" if platform.lower() == "linkedin" else "site:x.com/"
            creator_query = " OR ".join([f"{site_modifier}{c.replace(' ', '').lower()}" for c in creators[:3]])
            query = f"{topic} ({creator_query})"
            snippets, sources = await _perform_search(query, settings)
            if snippets:
                source = "curated_search"
                confidence = "high"
        
        # 3. General Search Fallback
        if not snippets:
            query = f"{topic} {platform} post examples"
            snippets, sources = await _perform_search(query, settings)
            if snippets:
                source = "general_search"
                confidence = "medium"

    # 4. Model Synthetic Structure
    if not snippets:
        snippets = await _generate_synthetic_structure(topic, platform, settings)
        sources = []  # No URLs for synthetic content
        if snippets:
            source = "synthetic_structure"
            confidence = "low"

    # Save to Cache if we got something
    if snippets and source:
        await _save_cache(topic, platform, snippets, session)
        return ResearchResult(
            topic=topic,
            platform=platform,
            content_snippets=snippets,
            sources=sources,
            confidence=confidence,
            source=source
        )

    # Absolute ultimate failure
    return ResearchResult(
        topic=topic,
        platform=platform,
        content_snippets=["No data could be retrieved from search or model."],
        sources=[],
        confidence="low",
        source="synthetic_structure"
    )
