from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    DATABASE_URL: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_FAST_MODEL: str | None = None
    GEMINI_DRAFT_MODEL: str | None = None
    SERP_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    DATABASE_SSL: bool = False
    RUN_RESUME_MIGRATION: bool = False
    PORT: int = 8000
    MODEL_TOKEN_PRICES: dict[str, dict[str, float]] = {}
    COST_PROMPT_PER_MILLION: float = 0.30
    COST_COMPLETION_PER_MILLION: float = 2.50
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] | str = ["http://localhost:3000"]
    ALLOWED_HOSTS: str = "localhost,127.0.0.1,testserver,*.onrender.com"
    # JWT signing key — REQUIRED in production. The `security` module
    # fails-closed at import time if this is missing/short, so this field
    # is allowed to be empty here (for the import to succeed) but is
    # validated downstream.
    JWT_SECRET_KEY: str = ""
    # Fernet key for encrypting resume PII at rest. Same fail-closed pattern.
    RESUME_ENCRYPTION_KEY: str = ""
    @property
    def allowed_hosts_list(self) -> list[str]:
        raw = self.ALLOWED_HOSTS.strip()
        if raw.startswith("["):
            import json
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [h.strip() for h in raw.split(",") if h.strip()]

    @property
    def allowed_cors_origins_list(self) -> list[str]:
        # CORS_ORIGINS is already parsed into a list by the assemble_csv_list
        # field_validator, so this property just exposes it for CORS middleware.
        origins = self.CORS_ORIGINS
        if isinstance(origins, list):
            return origins
        return [origins]
    
    @field_validator('DATABASE_URL')
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if not v:
            # Allow empty in test/CI environments where DB isn't available.
            # Production deployments MUST set DATABASE_URL via env/secrets.
            import os
            if os.getenv("ENVIRONMENT", "development") == "production":
                print(
                    "FATAL: DATABASE_URL is not set in production. "
                    "Set it via Render/Docker environment variables.",
                    file=__import__('sys').stderr,
                )
                __import__('sys').exit(1)
            return v
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    
    @field_validator('CORS_ORIGINS', mode='after')
    @classmethod
    def assemble_csv_list(cls, v: object) -> object:
        # Accept both JSON arrays and comma-separated strings from env vars
        # (docker-compose passes lists as comma-separated strings)
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                import json
                try:
                    return json.loads(v_str)
                except Exception:
                    pass
            return [item.strip() for item in v_str.split(",") if item.strip()]
        return v
    
    # Ignore obsolete deployment keys; no environment variable can grant a role.
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

@lru_cache
def get_settings() -> Settings:
    return Settings()
