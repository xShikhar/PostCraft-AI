from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postcraft:postcraft@localhost:5432/postcraft"
    GEMINI_API_KEY: str = ""
    SERP_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    
    
    @field_validator('DATABASE_URL')
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if v and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    
    model_config = SettingsConfigDict(env_file='.env')

@lru_cache
def get_settings() -> Settings:
    return Settings()
