from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Project, Generation, User
from app.schemas.api import GenerateRequest, GenerateResponse
from app.schemas.orchestrator import PipelineState
from app.services.orchestrator import PostGenerationPipeline
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/generations", tags=["generations"])

@router.post("", response_model=GenerateResponse)
async def generate_post(req: GenerateRequest, session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Fetch or create a project for this user/platform
    stmt = select(Project).where(
        Project.user_id == current_user.id,
        Project.platform == req.platform
    ).order_by(Project.id.desc()).limit(1)
    res = await session.execute(stmt)
    project = res.scalars().first()
    
    if not project:
        project = Project(
            user_id=current_user.id,
            name=f"{req.platform.capitalize()} Content",
            platform=req.platform
        )
        session.add(project)
        await session.commit()
        await session.refresh(project)

    # Create Generation
    gen = Generation(
        project_id=project.id,
        topic=req.topic,
        raw_thoughts=req.raw_thoughts
    )
    session.add(gen)
    await session.commit()
    await session.refresh(gen)

    # Initialize Pipeline State
    state = PipelineState(
        generation_id=gen.id,
        project_id=project.id,
        user_id=current_user.id,
        platform=req.platform,
        topic=req.topic,
        raw_thoughts=req.raw_thoughts
    )

    # Run Pipeline
    pipeline = PostGenerationPipeline(session)
    final_state = await pipeline.run(state)

    return GenerateResponse(
        generation_id=final_state.generation_id,
        status=final_state.error if final_state.error else ("needs_review" if final_state.quality_results and not final_state.quality_results.startswith("PASS") else "editing"),
        draft_1=final_state.drafts.draft_1 if final_state.drafts else None,
        draft_2=final_state.drafts.draft_2 if final_state.drafts else None,
        draft_3=final_state.drafts.draft_3 if final_state.drafts else None,
        error=final_state.error
    )
