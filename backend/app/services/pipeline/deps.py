from dataclasses import dataclass
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import Settings

@dataclass
class PipelineDeps:
    session: AsyncSession
    llm: Optional[ChatGoogleGenerativeAI]
    settings: Settings
