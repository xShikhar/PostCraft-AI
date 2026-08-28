from typing import List, Optional
from pydantic import BaseModel
import uuid

class GenerateRequest(BaseModel):
    topic: str
    platform: str
    raw_thoughts: str
    profile_context: Optional[str] = None  # Optional user bio/profile/resume text for lead-gen CTA context
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
    error: Optional[str] = None

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    profile_context: Optional[str] = None

class UserUpdate(BaseModel):
    profile_context: Optional[str] = None
