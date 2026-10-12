import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, timezone

from app.services.research import cascading_search, _generate_synthetic_structure
from app.models import ResearchCache
from app.schemas.research import ResearchResult
from app.core.config import Settings

@pytest.mark.asyncio
async def test_cascading_search_cache_miss_and_hit(db_session: AsyncSession):
    topic = "Test Topic"
    platform = "linkedin"

    mock_snippets = ["Tavily Snippet 1", "Tavily Snippet 2"]

    with patch("app.services.research._search_tavily", new_callable=AsyncMock) as mock_tavily:
        mock_tavily.return_value = (mock_snippets, [])
        
        # 1. First call: Cache miss. Should call Tavily and save to DB.
        res1 = await cascading_search(topic, platform, db_session)
        assert res1.source == "curated_search"
        assert len(res1.content_snippets) == 2
        mock_tavily.assert_called_once()
        
        # Check DB
        stmt = select(ResearchCache).where(ResearchCache.topic == topic)
        db_res = await db_session.execute(stmt)
        cache_entry = db_res.scalars().first()
        assert cache_entry is not None
        
        # Reset mocks
        mock_tavily.reset_mock()

        # 2. Second call: Cache hit. Should NOT call Tavily.
        res2 = await cascading_search(topic, platform, db_session)
        assert res2.source == "cache"
        mock_tavily.assert_not_called()

        # 3. Simulate TTL expiry
        cache_entry.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db_session.add(cache_entry)
        await db_session.commit()

        # 4. Third call: Expired cache. Should call Tavily again.
        res3 = await cascading_search(topic, platform, db_session)
        assert res3.source == "curated_search"
        mock_tavily.assert_called_once()

@pytest.mark.asyncio
async def test_synthetic_fallback_tier(db_session: AsyncSession):
    """Verifies that when external search APIs fail or return no results,
    the pipeline falls back to Gemini synthetic structural examples,
    returns source='synthetic_structure', and saves the result to cache."""
    topic = "Advanced Systems Architecture"
    platform = "linkedin"
    
    # Mock search returning empty results
    with patch("app.services.research._perform_search", new_callable=AsyncMock) as mock_search, \
         patch("app.services.research._generate_synthetic_structure", new_callable=AsyncMock) as mock_synth:
        
        mock_search.return_value = ([], [])
        mock_synth.return_value = (["Synthetic Hook 1\nBody 1", "Synthetic Hook 2\nBody 2"], 150, 45, 0)
        
        res = await cascading_search(topic, platform, db_session)
        
        assert res.source == "synthetic_structure"
        assert res.confidence == "low"
        assert len(res.content_snippets) == 2
        assert "Synthetic Hook 1" in res.content_snippets[0]
        mock_synth.assert_called_once()
        
        # Confirm cached in database
        stmt = select(ResearchCache).where(ResearchCache.topic == topic)
        db_res = await db_session.execute(stmt)
        cache_entry = db_res.scalars().first()
        assert cache_entry is not None

@pytest.mark.asyncio
async def test_generate_synthetic_structure_direct():
    """Unit test verifying _generate_synthetic_structure directly,
    ensuring time tracking, bounded backoff invocation, and token accounting."""
    settings = Settings(
        GEMINI_API_KEY="test-mock-gemini-key",
        GEMINI_MODEL="gemini-3.5-flash-lite",
    )
    
    mock_resp = MagicMock()
    mock_resp.content = "Simulated Structural Example:\nHook -> Context -> Tradeoff"
    mock_resp.usage_metadata = {
        "input_tokens": 120,
        "output_tokens": 65,
        "output_token_details": {"reasoning": 0}
    }
    
    mock_telemetry = MagicMock()
    
    with patch("app.services.pipeline.llm_utils.invoke_with_bounded_backoff", new_callable=AsyncMock) as mock_invoke:
        mock_invoke.return_value = mock_resp
        
        snippets, p_tok, c_tok, r_tok = await _generate_synthetic_structure(
            topic="Microservices vs Monoliths",
            platform="linkedin",
            settings=settings,
            telemetry=mock_telemetry
        )
        
        assert len(snippets) == 1
        assert "Simulated Structural Example" in snippets[0]
        assert p_tok == 120
        assert c_tok == 65
        assert r_tok == 0
        mock_telemetry.record_call.assert_called_once()
