import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.models import User, Project
from app.config import get_settings

async def main():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Create user
        user = User(username="test_user")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        # Create project
        project = Project(user_id=user.id, name="Test Project", platform="linkedin")
        session.add(project)
        await session.commit()
        
        # Query back
        stmt = select(User).where(User.username == "test_user")
        result = await session.execute(stmt)
        fetched_user = result.scalars().first()
        
        print(f"Created User: {fetched_user.username} (ID: {fetched_user.id})")
        
        stmt_proj = select(Project).where(Project.user_id == fetched_user.id)
        result_proj = await session.execute(stmt_proj)
        fetched_proj = result_proj.scalars().first()
        
        print(f"Created Project: {fetched_proj.name} for platform {fetched_proj.platform}")

if __name__ == "__main__":
    asyncio.run(main())
