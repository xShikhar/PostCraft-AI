import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.models import StyleProfile
from app.services.orchestrator import PostGenerationPipeline
from app.schemas.orchestrator import PipelineState

@pytest.fixture
def mock_genai_client():
    with patch("app.services.orchestrator.genai.Client") as mock:
        client_instance = mock.return_value
        yield client_instance

@pytest.mark.asyncio
async def test_pipeline_short_circuit(db_session: AsyncSession, mock_genai_client):
    # 1. Setup a StyleProfile so the pipeline skips pattern extraction
    profile = StyleProfile(
        user_id=uuid.uuid4(),
        platform="linkedin",
        structure="Pattern A",
        tone="Professional"
    )
    db_session.add(profile)
    await db_session.commit()

    state = PipelineState(
        generation_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id=profile.user_id,
        platform="linkedin",
        topic="Test Topic",
        raw_thoughts="Thoughts"
    )

    pipeline = PostGenerationPipeline(db_session)
    
    # Mock research to return a fast cache hit mock
    with patch("app.services.orchestrator.cascading_search", new_callable=AsyncMock) as mock_search:
        from app.schemas.research import ResearchResult
        mock_search.return_value = ResearchResult(
            topic="Test Topic",
            platform="linkedin",
            content_snippets=[],
            confidence="low",
            source="synthetic_structure"
        )
        
        # Mock genai response
        mock_response = AsyncMock()
        mock_response.text = '{"draft_1": "D1", "draft_2": "D2", "draft_3": "D3"}'
        mock_genai_client.models.generate_content.return_value = mock_response

        # Mock check_originality to return PASS
        pipeline.check_originality = lambda d, r: True

        final_state = await pipeline.run(state)
        
        # Assertions
        assert final_state.error is None
        assert final_state.drafts is not None
        assert final_state.drafts.draft_1 == "D1"

        # generate_content should be called exactly once for draft generation, NOT for pattern extraction.
        # Wait, the quality check might also call generate_content if originality passes!
        # The quality check calls generate_content to verify hooks/CTAs.
        
        # Let's mock the quality check to avoid the second generate_content call
        with patch.object(pipeline, 'node_quality_check', new_callable=AsyncMock) as mock_qc:
            mock_qc.return_value = state  # just pass through
            
            state2 = PipelineState(
                generation_id=uuid.uuid4(),
                project_id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                platform="linkedin",
                topic="Test Topic",
                raw_thoughts="Thoughts"
            )
            final_state2 = await pipeline.run(state2)
            # Only draft generation should have called Gemini
            mock_genai_client.models.generate_content.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_retry_on_quality_failure(db_session: AsyncSession, mock_genai_client):
    state = PipelineState(
        generation_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        platform="linkedin",
        topic="Retry Topic",
        raw_thoughts="Thoughts"
    )
    
    pipeline = PostGenerationPipeline(db_session)
    
    with patch("app.services.orchestrator.cascading_search", new_callable=AsyncMock) as mock_search:
        from app.schemas.research import ResearchResult
        mock_search.return_value = ResearchResult(
            topic="Retry Topic",
            platform="linkedin",
            content_snippets=[],
            confidence="low",
            source="synthetic_structure"
        )
        
        # Mock Draft Generation Response
        mock_draft_response = AsyncMock()
        mock_draft_response.text = '{"draft_1": "D1", "draft_2": "D2", "draft_3": "D3"}'
        
        # Mock Pattern Extraction Response
        mock_pattern_response = AsyncMock()
        mock_pattern_response.text = 'Extracted patterns.'
        
        # We need `generate_content` to return pattern response, then draft response, then draft response.
        mock_genai_client.models.generate_content.side_effect = [
            mock_pattern_response,
            mock_draft_response,
            mock_draft_response,
        ]

        # Mock Quality Check: Fail first time, Pass second time.
        pipeline.check_originality = lambda d, r: True
        
        call_count = 0
        original_qc = pipeline.node_quality_check
        
        async def mock_qc(st):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                st.quality_results = "FAIL: missing CTA"
                return st
            else:
                st.quality_results = "PASS"
                return st
                
        pipeline.node_quality_check = mock_qc
        
        final_state = await pipeline.run(state)
        
        assert call_count == 2
        assert final_state.quality_results == "PASS"
