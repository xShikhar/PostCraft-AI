"""Disposable real API for browser integration; never uses the configured user DB.

Run from backend: .venv/Scripts/python.exe tests/serve_browser_e2e.py
Only --live-ai allows configured provider keys; default checks never call providers.
"""
import argparse
import asyncio
import os
from pathlib import Path
import secrets
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8765)
parser.add_argument("--live-ai", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parents[2] / "scratch" / "browser-e2e" / uuid.uuid4().hex
root.mkdir(parents=True)
from cryptography.fernet import Fernet

os.environ.update(DATABASE_URL="sqlite+aiosqlite:///" + (root / "app.db").as_posix(),
                  JWT_SECRET_KEY=secrets.token_urlsafe(48), RESUME_ENCRYPTION_KEY=Fernet.generate_key().decode(),
                  DATABASE_SSL="false", ENVIRONMENT="test", DEBUG="false", SENTRY_DSN="",
                  CHROMA_HOST="localhost", CHROMA_PERSIST_DIR=str(root / "chroma_data"),
                  RATE_LIMIT_STORAGE_URI="memory://", ALLOWED_HOSTS="localhost,127.0.0.1",
                  CORS_ORIGINS="http://127.0.0.1:3000,http://127.0.0.1:3131")
if not args.live_ai:
    os.environ.update(GEMINI_API_KEY="", TAVILY_API_KEY="", SERP_API_KEY="")

from app.main import app
from app.core.database import Base, _engine, _session_maker
from app.core.security import get_password_hash
from app.models import User, Project, Generation


async def seed():
    async with _engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with _session_maker() as session:
        writer = User(id=uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), username="e2e_writer", password_hash=get_password_hash("local-e2e-password123"))
        session.add(writer)
        await session.flush()
        project = Project(user_id=writer.id, name="Disposable browser integration", platform="linkedin")
        session.add(project)
        await session.flush()
        draft = "A decision becomes actionable when it has an owner. Give each review a deadline and make the next step explicit."
        session.add(Generation(id=uuid.UUID("11111111-1111-4111-8111-111111111111"), project_id=project.id,
                               topic="Decision ownership", raw_thoughts="Give each review a named owner and a deadline.",
                               draft_1=draft, draft_2=draft + " Start with the next review.", draft_3=draft + " Make ownership visible.",
                               status="editing", original_drafts={"draft_1": draft}, research_data={"source": "synthetic_structure", "confidence": "low", "sources": []}))
        await session.commit()
    await _engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
    import uvicorn
    print("Disposable browser API ready. Provider calls " + ("enabled." if args.live_ai else "disabled by empty test credentials."), flush=True)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning", access_log=False)
