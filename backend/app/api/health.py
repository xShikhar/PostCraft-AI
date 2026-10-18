from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import get_settings

router = APIRouter(prefix="/api", tags=["health"])
settings = get_settings()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT
    }

@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
