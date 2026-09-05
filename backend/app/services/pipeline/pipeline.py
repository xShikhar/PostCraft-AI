import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from langchain_google_genai import ChatGoogleGenerativeAI

from app.models import Generation
from app.core.config import get_settings
from app.services.pipeline.deps import PipelineDeps
from app.services.pipeline.state import PipelineState, GraphState
from app.services.pipeline.graph import build_graph

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

class PostGenerationPipeline:
    """
    Public entry point for the post generation pipeline.
    Initializes dependencies and executes the LangGraph workflow.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        settings = get_settings()
        
        llm = None
        if settings.GEMINI_API_KEY:
            llm = ChatGoogleGenerativeAI(
                model=GEMINI_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
            )

        self.deps = PipelineDeps(session=session, llm=llm, settings=settings)
        self.graph = build_graph(self.deps)

    async def run(self, state: PipelineState) -> PipelineState:
        """
        Execute the LangGraph pipeline.

        Accepts and returns PipelineState for API compatibility.
        Internally maps to GraphState (TypedDict) for LangGraph execution.
        """
        initial_state: GraphState = {
            "generation_id": str(state.generation_id),
            "project_id": str(state.project_id),
            "user_id": str(state.user_id),
            "platform": state.platform,
            "topic": state.topic,
            "raw_thoughts": state.raw_thoughts,
            "profile_context": state.profile_context or "",
            "use_context": state.use_context,
            "research_result": None,
            "extracted_pattern": None,
            "drafts": None,
            "retry_count": 0,
            "quality_results": "",
            "substance_score": None,
            "error": "",
            "skip_extraction": False,
        }

        try:
            logger.info(f"Starting LangGraph pipeline for Generation {state.generation_id}")
            final = await self.graph.ainvoke(initial_state)
        except Exception as e:
            logger.error(f"LangGraph pipeline error: {e}", exc_info=True)
            state.error = str(e)
            try:
                gen_id = state.generation_id
                stmt = select(Generation).where(Generation.id == gen_id)
                result = await self.session.execute(stmt)
                generation = result.scalars().first()
                if generation:
                    generation.status = "failed"
                    self.session.add(generation)
                    await self.session.commit()
            except Exception:
                logger.error("Failed to save error state to DB", exc_info=True)
            return state

        return self._to_pipeline_state(state, final)

    @staticmethod
    def _to_pipeline_state(original: PipelineState, graph_output: dict) -> PipelineState:
        """Convert final GraphState dict back to PipelineState."""
        original.research_result = graph_output.get("research_result")
        original.extracted_pattern = graph_output.get("extracted_pattern")
        original.drafts = graph_output.get("drafts")
        original.retry_count = graph_output.get("retry_count", 0)
        original.quality_results = graph_output.get("quality_results") or None
        original.substance_score = graph_output.get("substance_score")
        original.error = graph_output.get("error") or None
        return original
