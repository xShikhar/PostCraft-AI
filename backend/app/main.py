import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.generations import router as generations_router
from app.api.editor import router as editor_router
from app.api.admin import router as admin_router
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PostCraft AI backend...")
    yield
    logger.info("Shutting down PostCraft AI backend...")

app = FastAPI(
    title="PostCraft AI",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(generations_router)
app.include_router(editor_router)
app.include_router(admin_router)
