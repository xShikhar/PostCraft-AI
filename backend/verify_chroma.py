import asyncio
import uuid
import json
from unittest.mock import AsyncMock, patch, MagicMock

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select

from app.config import get_settings
from app.models import Base, User, Project, Generation, StyleProfile
from app.schemas.orchestrator import PipelineState, ExtractedPattern
from app.services.orchestrator import PostGenerationPipeline
from app.services.vector import vector_service

# We will patch the Gemini Client to mock responses so we don't need a real API key.
class MockGenerateContentResponse:
    def __init__(self, text="", function_calls=None, usage_metadata=None):
        self.text = text
        self.function_calls = function_calls
        self.usage_metadata = usage_metadata

class MockFunctionCall:
    def __init__(self, name, args):
        self.name = name
        self.args = args

class MockGeminiModels:
    def generate_content(self, model, contents, config=None):
        # Determine what to return based on the prompt contents
        if "Analyze the following public" in contents:
            # Pattern Extraction mock
            # Check if historical bias is present in the prompt
            if "historical preferred style" in contents:
                print("\n[MOCK GEMINI] Detected Historical Bias in Prompt!")
                print(f"Bias snippet found: {contents[contents.find('Here is the user'):contents.find('Here is the user')+150]}...")
                
            return MockGenerateContentResponse(
                function_calls=[
                    MockFunctionCall(
                        name="extract_style_patterns",
                        args={
                            "structure": "Mock Structure",
                            "tone": "Mock Tone",
                            "pacing": "Mock Pacing",
                            "storytelling_technique": "Mock Storytelling",
                            "formatting": "Mock Formatting",
                            "cta_style": "Mock CTA"
                        }
                    )
                ]
            )
        elif "You are an expert ghostwriter" in contents:
            # Draft Generation mock
            return MockGenerateContentResponse(
                text=json.dumps({
                    "draft_1": "Draft 1 Text",
                    "draft_2": "Draft 2 Text",
                    "draft_3": "Draft 3 Text"
                }),
                usage_metadata=MagicMock(prompt_token_count=100, candidates_token_count=50)
            )
        else:
            return MockGenerateContentResponse(text="Mock text")

class MockGeminiClient:
    def __init__(self, api_key=None):
        self.models = MockGeminiModels()

@patch("app.services.orchestrator.genai.Client", return_value=MockGeminiClient())
async def main(mock_client_class):
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        # 1. Setup User & Project
        user_id = uuid.uuid4()
        user = User(id=user_id, username=f"chroma_test_{user_id.hex[:8]}")
        project = Project(user_id=user_id, name="Test Project", platform="linkedin")
        session.add(user)
        session.add(project)
        await session.commit()
        await session.refresh(project)
        
        # 2. GENERATION 1: No previous style
        print("=== RUNNING GENERATION 1 (No past style) ===")
        gen1 = Generation(
            project_id=project.id, topic="First Topic", raw_thoughts="First thoughts", status="generating"
        )
        session.add(gen1)
        await session.commit()
        await session.refresh(gen1)
        
        state1 = PipelineState(
            generation_id=gen1.id, project_id=project.id, user_id=user.id,
            platform="linkedin", topic=gen1.topic, raw_thoughts=gen1.raw_thoughts
        )
        
        pipeline = PostGenerationPipeline(session)
        
        # Force a client bypass so it uses our mock (orchestrator handles this via settings.GEMINI_API_KEY)
        pipeline.client = MockGeminiClient()
        
        await pipeline.run(state1)
        
        # Verify it saved to ChromaDB
        print("\nChecking ChromaDB for saved profile...")
        # Since we mock the API, it extracted "Mock Structure", etc.
        # Let's query chroma directly
        res = vector_service.get_similar_profile(str(user.id), "linkedin", "Some query to match mock")
        if res:
            print(f"SUCCESS: ChromaDB stored -> {res[:100]}...")
        else:
            print("FAIL: Nothing in ChromaDB.")
            
        # 3. GENERATION 2: Should retrieve the style
        print("\n=== RUNNING GENERATION 2 (Should retrieve past style) ===")
        gen2 = Generation(
            project_id=project.id, topic="Second Topic", raw_thoughts="Second thoughts", status="generating"
        )
        session.add(gen2)
        await session.commit()
        await session.refresh(gen2)
        
        state2 = PipelineState(
            generation_id=gen2.id, project_id=project.id, user_id=user.id,
            platform="linkedin", topic=gen2.topic, raw_thoughts=gen2.raw_thoughts
        )
        
        pipeline2 = PostGenerationPipeline(session)
        pipeline2.client = MockGeminiClient()
        
        # This will trigger the print statement in our mock if the prompt contains the historical bias
        await pipeline2.run(state2)
        
        print("\nTest completed.")

if __name__ == "__main__":
    asyncio.run(main())
