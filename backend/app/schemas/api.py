from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator
import uuid


class GenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    platform: Literal["linkedin", "x"] = Field(..., description="Target platform: 'linkedin' or 'x'")
    raw_thoughts: str = Field(..., min_length=1, max_length=5000)
    profile_context: Optional[str] = Field(default=None, max_length=3000)
    use_context: bool = True  # When False, skip injecting resume/about-me into the generation prompt

    @field_validator("topic", "raw_thoughts", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v


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
    profile_context: Optional[str] = Field(default=None, max_length=3000)
    about_me: Optional[str] = Field(default=None, max_length=2000)
