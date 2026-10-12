import logging
import uuid
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import SQLAlchemyError

from app.services.pipeline.background_tasks import (
    bg_log_cost,
    bg_save_and_cleanup_style_profile,
    bg_save_research_cache,
)


@pytest.mark.asyncio
async def test_bg_log_cost_failure_is_logged_and_does_not_raise(caplog):
    generation_id = "test-gen-cost-fail-001"
    caplog.set_level(logging.ERROR)

    # Simulate database session failure
    mock_session_maker = MagicMock()
    mock_session_maker.side_effect = SQLAlchemyError("Simulated pool disconnection")

    with patch("app.services.pipeline.background_tasks._session_maker", mock_session_maker):
        # Must not raise an unhandled exception
        await bg_log_cost(
            generation_id=generation_id,
            operation="draft_generation",
            prompt_tokens=150,
            completion_tokens=450,
        )

    # Check that failure was logged with the exact generation ID
    assert generation_id in caplog.text
    assert "Background cost log write failed" in caplog.text


@pytest.mark.asyncio
async def test_bg_style_profile_failure_is_logged_and_does_not_raise(caplog):
    generation_id = "test-gen-style-fail-002"
    caplog.set_level(logging.ERROR)

    mock_session_maker = MagicMock()
    mock_session_maker.side_effect = SQLAlchemyError("Simulated disk error")

    with patch("app.services.pipeline.background_tasks._session_maker", mock_session_maker):
        # Must not raise
        await bg_save_and_cleanup_style_profile(
            generation_id=generation_id,
            user_id=str(uuid.uuid4()),
            platform="linkedin",
            extracted_dict={
                "structure": "Hook -> 3 contrarian points -> CTA",
                "tone": "Direct",
            },
        )

    assert generation_id in caplog.text
    assert "Background style profile write failed" in caplog.text


@pytest.mark.asyncio
async def test_bg_research_cache_failure_is_logged_and_does_not_raise(caplog):
    generation_id = "test-gen-cache-fail-003"
    caplog.set_level(logging.ERROR)

    mock_session_maker = MagicMock()
    mock_session_maker.side_effect = SQLAlchemyError("Simulated cache lock failure")

    with patch("app.services.pipeline.background_tasks._session_maker", mock_session_maker):
        # Must not raise
        await bg_save_research_cache(
            generation_id=generation_id,
            topic="B2B sales strategy",
            platform="linkedin",
            snippets=["Snippet 1", "Snippet 2"],
        )

    assert generation_id in caplog.text
    assert "Background research cache write failed" in caplog.text
