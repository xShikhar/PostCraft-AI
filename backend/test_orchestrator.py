import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select

from app.config import get_settings
from app.models import Base, User, Project, Generation
from app.schemas.orchestrator import PipelineState
from app.services.orchestrator import PostGenerationPipeline

async def main():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Get or create a test user and project
        result = await session.execute(select(User).limit(1))
        user = result.scalars().first()
        if not user:
            user = User(username="orchestrator_test_user")
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
        result_proj = await session.execute(select(Project).where(Project.user_id == user.id).limit(1))
        project = result_proj.scalars().first()
        if not project:
            project = Project(user_id=user.id, name="Test Project", platform="linkedin")
            session.add(project)
            await session.commit()
            await session.refresh(project)
            
        # Create a mock generation
        gen = Generation(
            project_id=project.id,
            topic="AI in B2B Sales",
            raw_thoughts="AI is completely changing how we do B2B sales. It's not about automation anymore, it's about personalization at scale. Sellers need to adapt or die.",
            status="generating"
        )
        session.add(gen)
        await session.commit()
        await session.refresh(gen)
        
        # Initialize pipeline state
        state = PipelineState(
            generation_id=gen.id,
            project_id=project.id,
            user_id=user.id,
            platform="linkedin",
            topic=gen.topic,
            raw_thoughts=gen.raw_thoughts
        )
        
        pipeline = PostGenerationPipeline(session)
        print("Running Pipeline...")
        final_state = await pipeline.run(state)
        
        print("\n=== PIPELINE RESULTS ===")
        print(f"Error: {final_state.error}")
        if final_state.research_result:
            print(f"Research Snippets: {len(final_state.research_result.content_snippets)}")
            
        if final_state.extracted_pattern:
            print("Extracted Pattern (Structure):", final_state.extracted_pattern.structure)
            
        if final_state.drafts:
            print("\nDraft 1 Preview:\n", final_state.drafts.draft_1[:100], "...")
            
        # Verify DB update
        stmt = select(Generation).where(Generation.id == gen.id)
        res = await session.execute(stmt)
        updated_gen = res.scalars().first()
        print(f"\nFinal DB Status: {updated_gen.status}")

if __name__ == "__main__":
    asyncio.run(main())
