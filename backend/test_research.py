import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import get_settings
from app.services.research import cascading_search
from app.models import Base

async def main():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    # Ensure tables exist (specifically ResearchCache) in case Alembic wasn't fully synced
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        print("--- First Run (Expected: synthetic_structure or failure if no keys) ---")
        result1 = await cascading_search("B2B Marketing Strategies", "linkedin", session)
        print(f"Source: {result1.source}")
        print(f"Confidence: {result1.confidence}")
        print(f"Snippets: {len(result1.content_snippets)}")
        if result1.content_snippets:
            print(f"First snippet preview: {result1.content_snippets[0][:100]}...")
            
        print("\n--- Second Run (Expected: cache) ---")
        result2 = await cascading_search("B2B Marketing Strategies", "linkedin", session)
        print(f"Source: {result2.source}")
        print(f"Confidence: {result2.confidence}")
        print(f"Snippets: {len(result2.content_snippets)}")

if __name__ == "__main__":
    asyncio.run(main())
