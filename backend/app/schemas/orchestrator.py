import uuid
from typing import Optional, List
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

class PipelineState(BaseModel):
    """State object passed through the orchestrator pipeline."""
    generation_id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    topic: str
    raw_thoughts: str
    
    # Populated by node_research
    research_result: Optional[ResearchResult] = None
    
    # Populated by node_pattern_extraction
    extracted_pattern: Optional[ExtractedPattern] = None
    
    # Populated by node_draft_generation
    drafts: Optional[GeneratedDrafts] = None
    
    # Populated by node_quality_check
    retry_count: int = 0
    quality_results: Optional[str] = None
    
    # Any errors that occurred
    error: Optional[str] = None
