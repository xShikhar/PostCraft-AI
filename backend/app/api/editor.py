import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models import Generation, ChatHistory, StyleProfile, Preference, Project, User
from app.schemas.editor import EditRequest, EditResponse, FinalizeRequest
from app.core.config import get_settings
from app.api.auth import get_current_user, auth_limiter

from google import genai

router = APIRouter(prefix="/api/generations", tags=["editor"])

@router.post("/{gen_id}/edit", response_model=EditResponse)
@auth_limiter.limit("20/hour")
async def edit_generation(
    request: Request,
    gen_id: uuid.UUID,
    req: EditRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch generation and project to verify ownership
    stmt = select(Generation, Project).join(Project).where(
        Generation.id == gen_id,
        Project.user_id == current_user.id
    )
    res = await session.execute(stmt)
    row = res.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Generation not found")
        
    generation = row.Generation

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    current_draft = ""
    if req.draft_index == 1: current_draft = generation.draft_1
    elif req.draft_index == 2: current_draft = generation.draft_2
    elif req.draft_index == 3: current_draft = generation.draft_3
    
    if not current_draft:
        raise HTTPException(status_code=400, detail="Draft is empty or invalid index")

    # Fetch Chat History
    hist_stmt = select(ChatHistory).where(ChatHistory.generation_id == gen_id).order_by(ChatHistory.created_at)
    hist_res = await session.execute(hist_stmt)
    history = hist_res.scalars().all()
    
    history_text = "\n".join([f"{h.role.upper()}: {h.content}" for h in history])
    
    prompt = f"""
    You are an expert editor. Below is the chat history of revisions, the current draft, and the user's new instruction.
    
    CHAT HISTORY:
    {history_text}
    
    CURRENT DRAFT:
    {current_draft}
    
    USER'S INSTRUCTION:
    {req.instruction}
    
    Revise the draft based on the user's instruction. Return ONLY the fully revised text. Do not include commentary.
    """
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    
    revised_text = response.text.strip()
    
    # Save history
    user_chat = ChatHistory(generation_id=gen_id, role="user", content=req.instruction)
    asst_chat = ChatHistory(generation_id=gen_id, role="assistant", content=revised_text)
    session.add_all([user_chat, asst_chat])
    
    # Update generation
    if req.draft_index == 1: generation.draft_1 = revised_text
    elif req.draft_index == 2: generation.draft_2 = revised_text
    elif req.draft_index == 3: generation.draft_3 = revised_text
    
    generation.active_draft_index = req.draft_index
    session.add(generation)
    
    await session.commit()
    
    return EditResponse(revised_draft=revised_text, status="success")

@router.post("/{gen_id}/finalize")
@auth_limiter.limit("30/hour")
async def finalize_generation(
    request: Request,
    gen_id: uuid.UUID,
    req: FinalizeRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch generation and project
    stmt = select(Generation, Project).join(Project).where(
        Generation.id == gen_id,
        Project.user_id == current_user.id
    )
    res = await session.execute(stmt)
    row = res.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Generation not found")
        
    generation = row.Generation
    project = row.Project

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    final_draft = ""
    if req.final_draft_index == 1: final_draft = generation.draft_1
    elif req.final_draft_index == 2: final_draft = generation.draft_2
    elif req.final_draft_index == 3: final_draft = generation.draft_3

    # Fetch original style profile for comparison
    sp_stmt = select(StyleProfile).where(
        StyleProfile.user_id == project.user_id,
        StyleProfile.platform == project.platform
    ).order_by(StyleProfile.id.desc()).limit(1)
    sp_res = await session.execute(sp_stmt)
    style_profile = sp_res.scalars().first()
    
    if style_profile and final_draft:
        # Extract Memory Preference
        prompt = f"""
        Compare the final selected draft with the originally extracted structural style.
        
        ORIGINAL EXTRACTED STYLE:
        Structure: {style_profile.structure}
        Tone: {style_profile.tone}
        
        FINAL PUBLISHED DRAFT:
        {final_draft}
        
        Analyze what stylistic choices the user actually kept vs. what they discarded. 
        Write a concise, 2-sentence summary of their true stylistic preference based on this final result.
        """
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        pref = Preference(
            user_id=project.user_id,
            platform=project.platform,
            preference_text=response.text.strip()
        )
        session.add(pref)
    
    generation.status = "finalized"
    session.add(generation)
    await session.commit()
    
    return {"status": "finalized"}
