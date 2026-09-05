from typing import List, Optional
from pydantic import BaseModel, Field
import uuid

class GenerateRequest(BaseModel):
    topic: str
    platform: str
    raw_thoughts: str
    profile_context: Optional[str] = None  # Optional user bio/profile/resume text for lead-gen CTA context
    use_context: bool = True  # When False, skip injecting resume/about-me into the generation prompt
    username: str = "default_user"  # hardcoded for prototype to avoid full auth flow
    project_name: str = "Default Project"

class SourceItemResponse(BaseModel):
    title: str = ""
    snippet: str = ""
    url: str = ""

class GenerateResponse(BaseModel):
    generation_id: uuid.UUID
    status: str
    draft_1: Optional[str] = None
    draft_2: Optional[str] = None
    draft_3: Optional[str] = None
    sources: List[SourceItemResponse] = []
    research_confidence: Optional[str] = None
    research_source: Optional[str] = None
    substance_score: Optional[int] = Field(
        default=None,
        description="Substance/originality-of-thought score (1-10) from quality check. Lower = more generic/AI-sounding."
    )
    error: Optional[str] = None

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    profile_context: Optional[str] = None
    about_me: Optional[str] = None

class UserUpdate(BaseModel):
    profile_context: Optional[str] = None
    about_me: Optional[str] = None
