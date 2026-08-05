from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class SourceItem(BaseModel):
    """A single research source with title, snippet preview, and URL."""
    title: str = ""
    snippet: str = ""
    url: str = ""

class ResearchResult(BaseModel):
    topic: str
    platform: str
    content_snippets: List[str] = Field(default_factory=list, description="Raw text snippets or posts retrieved")
    sources: List[SourceItem] = Field(default_factory=list, description="Structured source items with title, snippet, and URL")
    confidence: Literal['high', 'medium', 'low'] = Field(
        ..., 
        description="'high' for curated creators, 'medium' for general search, 'low' for model hallucinated fallback"
    )
    source: Literal['cache', 'curated_search', 'general_search', 'synthetic_structure']
