import pytest
import uuid
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import User, Project, Generation, CostLog
from app.services.pipeline.deps import PipelineDeps
from app.services.pipeline.graph import build_graph
from app.services.pipeline.pipeline import PostGenerationPipeline
from app.services.pipeline.state import PipelineState, ExtractedPattern, GeneratedDrafts, QualityVerdict

def test_pipeline_graph_compiles():
    """Verify that the LangGraph StateGraph builds and compiles without errors."""
    mock_session = MagicMock()
    mock_llm = MagicMock()
    mock_settings = MagicMock()
    
    deps = PipelineDeps(
        session=mock_session,
        llm=mock_llm,
        settings=mock_settings
    )
    
    graph = build_graph(deps)
    assert graph is not None
    assert "research" in graph.nodes
    assert "draft_generation" in graph.nodes
    assert "quality_check" in graph.nodes
    assert "save_generation" in graph.nodes

@pytest.mark.asyncio
async def test_pipeline_full_execution(db_session: AsyncSession):
    """End-to-end test of the compiled LangGraph pipeline with mocked LLM."""
    # 1. Setup DB records
    user = User(id=uuid.uuid4(), username="graph_tester", password_hash="hash")
    project = Project(id=uuid.uuid4(), user_id=user.id, name="Test Project", platform="linkedin")
    gen = Generation(id=uuid.uuid4(), project_id=project.id, topic="Test Topic", raw_thoughts="Test Thoughts", status="generating")
    
    db_session.add_all([user, project, gen])
    await db_session.commit()

    # 2. Setup Mock LLM
    mock_llm = MagicMock()
    
    pattern_mock = ExtractedPattern(
        structure="Hook -> Bullets -> CTA",
        tone="Direct",
        pacing="Fast",
        storytelling_technique="Personal anecdote",
        formatting="Short paragraphs",
        cta_style="DM invitation"
    )
    drafts_mock = GeneratedDrafts(
        draft_1="Draft 1: Why async work matters. DM me to learn more.",
        draft_2="Draft 2: Stop having meetings. DM me for the framework.",
        draft_3="Draft 3: Velocity increases with focus. Send me a message."
    )
    verdict_mock = QualityVerdict(passed=True)

    # Mock structured output
    def mock_with_structured(model, include_raw=False):
        runner = MagicMock()
        if model == ExtractedPattern:
            runner.ainvoke = AsyncMock(return_value={
                "parsed": pattern_mock,
                "raw": MagicMock(usage_metadata={"input_tokens": 100, "output_tokens": 50})
            })
        elif model == GeneratedDrafts:
            runner.ainvoke = AsyncMock(return_value={
                "parsed": drafts_mock,
                "raw": MagicMock(usage_metadata={"input_tokens": 200, "output_tokens": 150})
            })
        elif model == QualityVerdict:
            runner.ainvoke = AsyncMock(return_value={
                "parsed": verdict_mock,
                "raw": MagicMock(usage_metadata={"input_tokens": 80, "output_tokens": 20})
            })
        return runner

    mock_llm.with_structured_output = mock_with_structured

    # 3. Instantiate and run pipeline
    pipeline = PostGenerationPipeline(session=db_session)
    pipeline.deps.llm = mock_llm
    # Rebuild graph with mocked LLM
    pipeline.graph = build_graph(pipeline.deps)

    initial_state = PipelineState(
        generation_id=gen.id,
        project_id=project.id,
        user_id=user.id,
        platform="linkedin",
        topic="Test Topic",
        raw_thoughts="Test Thoughts",
        profile_context="CTO helping engineering teams go async"
    )

    final_state = await pipeline.run(initial_state)

    # 4. Assertions
    assert final_state.drafts is not None
    assert final_state.drafts.draft_1 == drafts_mock.draft_1
    assert final_state.error is None
    assert final_state.quality_results == "PASS"

    # Verify DB Generation record updated
    stmt = select(Generation).where(Generation.id == gen.id)
    db_gen = (await db_session.execute(stmt)).scalars().first()
    assert db_gen.status == "editing"
    assert db_gen.draft_1 == drafts_mock.draft_1
    assert db_gen.draft_2 == drafts_mock.draft_2
    assert db_gen.draft_3 == drafts_mock.draft_3
