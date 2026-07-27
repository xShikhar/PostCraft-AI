from typing import List, Optional
from pydantic import BaseModel
import uuid

class GenerateRequest(BaseModel):
    topic: str
    platform: str
    raw_thoughts: str
    username: str = "default_user"  # hardcoded for prototype to avoid full auth flow
    project_name: str = "Default Project"

class GenerateResponse(BaseModel):
    generation_id: uuid.UUID
    status: str
    draft_1: Optional[str] = None
    draft_2: Optional[str] = None
    draft_3: Optional[str] = None
    error: Optional[str] = None
