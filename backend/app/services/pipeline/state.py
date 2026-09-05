import uuid
from typing import Optional, TypedDict
from pydantic import BaseModel, Field
from app.schemas.research import ResearchResult

class ExtractedPattern(BaseModel):
    """The structured output format for Gemini's pattern extraction."""
    structure: str = Field(description="The underlying structure or framework of the post (e.g. Hook -> 3 bullet points -> Conclusion).")
    tone: str = Field(description="The emotional tone of the post (e.g. conversational, urgent, authoritative).")
    pacing: str = Field(description="The pacing and rhythm of the writing (e.g. short punchy sentences, long flowing paragraphs).")
    storytelling_technique: str = Field(description="The narrative or storytelling mechanism used.")
    formatting: str = Field(description="Any specific formatting choices (e.g. aggressive line breaks, specific emoji usage).")
    cta_style: str = Field(description="How the Call to Action is styled and positioned.")

class GeneratedDrafts(BaseModel):
    """The structured output format for the final generation step."""
    draft_1: str = Field(description="First draft variation.")
    draft_2: str = Field(description="Second draft variation, significantly different approach.")
    draft_3: str = Field(description="Third draft variation, unique angle or hook.")

class QualityVerdict(BaseModel):
    """Structured output for the LLM quality check gate (originality + structural completeness + lead-gen CTA + substance)."""
    passed: bool = Field(description="True if all drafts pass all checks.")
    failed_check: Optional[str] = Field(
        default=None,
        description="Which check failed: 'originality', 'structural_completeness', 'lead_gen_cta', or 'substance'"
    )
    failed_drafts: Optional[str] = Field(
        default=None,
        description="Which draft(s) failed and a concise explanation of why, for feedback injection."
    )
    substance_score: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Overall substance / originality-of-thought score from 1-10 across all drafts. Lower = more generic/AI-sounding."
    )

class PipelineState(BaseModel):
    """State object passed through the orchestrator pipeline."""
    generation_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    topic: str
    raw_thoughts: str
    profile_context: Optional[str] = None  # Optional user bio/profile/resume text for lead-gen CTA context
    use_context: bool = True  # When False, skip background-context injection (resume/about-me)

    # Populated by node_research
    research_result: Optional[ResearchResult] = None

    # Populated by node_pattern_extraction
    extracted_pattern: Optional[ExtractedPattern] = None

    # Populated by node_draft_generation
    drafts: Optional[GeneratedDrafts] = None

    # Populated by node_quality_check
    retry_count: int = 0
    quality_results: Optional[str] = None
    substance_score: Optional[int] = None  # 1-10 score from the substance gate

    # Any errors that occurred
    error: Optional[str] = None

class GraphState(TypedDict, total=False):
    """LangGraph state representation. A flat dict matching PipelineState fields + skip_extraction flag."""
    generation_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    topic: str
    raw_thoughts: str
    profile_context: Optional[str]
    use_context: bool

    research_result: Optional[ResearchResult]
    extracted_pattern: Optional[ExtractedPattern]
    drafts: Optional[GeneratedDrafts]
    snippets_text: str  # Local var in prompt builders, not shared across nodes

    retry_count: int
    quality_results: Optional[str]
    quality_feedback: Optional[str]  # Populated by quality_check; consumed by draft_generation on retry
    substance_score: Optional[int]  # 1-10 score from substance gate
    error: Optional[str]
    skip_extraction: bool
