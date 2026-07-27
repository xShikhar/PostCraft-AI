from pydantic import BaseModel

class EditRequest(BaseModel):
    instruction: str
    draft_index: int = 1 # Which draft to edit

class EditResponse(BaseModel):
    revised_draft: str
    status: str

class FinalizeRequest(BaseModel):
    final_draft_index: int = 1
