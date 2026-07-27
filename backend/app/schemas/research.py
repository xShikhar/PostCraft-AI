from pydantic import BaseModel, Field
from typing import List, Literal

class ResearchResult(BaseModel):
    topic: str
    platform: str
    content_snippets: List[str] = Field(default_factory=list, description="Raw text snippets or posts retrieved")
    confidence: Literal['high', 'medium', 'low'] = Field(
        ..., 
        description="'high' for curated creators, 'medium' for general search, 'low' for model hallucinated fallback"
    )
    source: Literal['cache', 'curated_search', 'general_search', 'synthetic_structure']
