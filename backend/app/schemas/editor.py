from typing import Literal
from pydantic import BaseModel, Field, field_validator


class EditRequest(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=2000, description="Revision instruction for the AI editor")
    draft_index: Literal[1, 2, 3] = Field(default=1, description="Which draft to edit (1, 2, or 3)")

    @field_validator("instruction", mode="before")
    @classmethod
    def strip_and_validate(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
        return v


class EditResponse(BaseModel):
    revised_draft: str
    reply: str = "Draft revised successfully."
    status: str


class FinalizeRequest(BaseModel):
    final_draft_index: Literal[1, 2, 3] = 1
    accept_warnings: bool = False
    review_token: str | None = Field(default=None, max_length=64)
