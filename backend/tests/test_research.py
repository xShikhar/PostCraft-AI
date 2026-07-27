import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.services.research import cascading_search
from app.models import ResearchCache
from app.schemas.research import ResearchResult
import datetime

@pytest.mark.asyncio
async def test_cascading_search_cache_miss_and_hit(db_session: AsyncSession):
    topic = "Test Topic"
    platform = "linkedin"

    mock_snippets = ["Tavily Snippet 1", "Tavily Snippet 2"]

    with patch("app.services.research._search_tavily", new_callable=AsyncMock) as mock_tavily, \
         patch("app.services.research._search_brave", new_callable=AsyncMock) as mock_brave, \
         patch("app.services.research.genai.Client", new_callable=AsyncMock) as mock_genai:
        
        mock_tavily.return_value = mock_snippets
        
        # 1. First call: Cache miss. Should call Tavily and save to DB.
        res1 = await cascading_search(topic, platform, db_session)
        assert res1.source == "curated_search"
        assert len(res1.content_snippets) == 2
        mock_tavily.assert_called_once()
        mock_brave.assert_not_called()
        
        # Check DB
        stmt = select(ResearchCache).where(ResearchCache.topic == topic)
        db_res = await db_session.execute(stmt)
        cache_entry = db_res.scalars().first()
        assert cache_entry is not None
        
        # Reset mocks
        mock_tavily.reset_mock()
        mock_brave.reset_mock()

        # 2. Second call: Cache hit. Should NOT call Tavily.
        res2 = await cascading_search(topic, platform, db_session)
        assert res2.source == "cache"
        mock_tavily.assert_not_called()

        # 3. Simulate TTL expiry
        cache_entry.expires_at = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        db_session.add(cache_entry)
        await db_session.commit()

        # 4. Third call: Expired cache. Should call Tavily again.
        res3 = await cascading_search(topic, platform, db_session)
        assert res3.source == "curated_search"
        mock_tavily.assert_called_once()
