from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator
import uuid
from datetime import datetime


class GenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
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
    updated_at: datetime
    research_retrieved_at: Optional[str] = None
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
    writing_style: Optional[str] = None
    is_admin: bool = False


class UserUpdate(BaseModel):
    profile_context: Optional[str] = Field(default=None, max_length=3000)
    about_me: Optional[str] = Field(default=None, max_length=2000)
    writing_style: Optional[str] = Field(default=None, max_length=2000)


class SaveDraftRequest(BaseModel):
    draft_index: Literal[1, 2, 3]
    content: str = Field(min_length=1, max_length=20000)
    expected_updated_at: datetime

    @field_validator("content")
    @classmethod
    def nonblank_content(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Draft content cannot be blank")
        return value


class SaveDraftResponse(BaseModel):
    generation_id: uuid.UUID
    draft_index: Literal[1, 2, 3]
    content: str
    updated_at: datetime
    status: str
