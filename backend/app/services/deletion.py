"""Durable vector erasure outbox, retried during startup and normal operation."""
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete, update
from app.core.database import _session_maker
from app.models import VectorDeletionJob, ResearchCache, Generation
from app.services.vector import vector_service

async def erase_vectors(user_id, session):
    await asyncio.to_thread(vector_service.delete_all_for_user, str(user_id))
    job = await session.get(VectorDeletionJob, user_id)
    if job:
        job.completed_at = datetime.now(timezone.utc)
        await session.commit()

async def retry_erasure_jobs():
    async with _session_maker() as session:
        jobs = (await session.execute(select(VectorDeletionJob).where((VectorDeletionJob.completed_at.is_(None)) | (VectorDeletionJob.created_at > datetime.now(timezone.utc) - timedelta(days=1))))).scalars().all()
        for job in jobs:
            try:
                await erase_vectors(job.user_id, session)
            except Exception:
                await session.rollback()
        await session.execute(delete(ResearchCache).where(ResearchCache.expires_at < datetime.now(timezone.utc)))
        await session.execute(update(Generation).where(Generation.status == "generating", Generation.created_at < datetime.now(timezone.utc) - timedelta(minutes=10)).values(status="failed"))
        await session.commit()

async def erasure_worker():
    while True:
        try:
            await retry_erasure_jobs()
        except Exception:
            pass  # Database/network outage: durable jobs are retried next cycle.
        await asyncio.sleep(30)
