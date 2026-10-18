"""Idempotent migration of legacy private fields; run before accepting traffic."""
import asyncio
from sqlalchemy import select
from app.core.database import _session_maker, _engine
from app.core.crypto import encrypt, decrypt, _get_fernet
from app.models import User, UserResume, Preference

async def migrate():
    _get_fernet()
    async with _session_maker() as session:
        for model, fields in ((User, ("about_me", "profile_context", "writing_style")), (UserResume, ("raw_text", "structured_summary")), (Preference, ("preference_text",))):
            rows = (await session.execute(select(model))).scalars().all()
            for row in rows:
                for field in fields:
                    value = getattr(row, field)
                    if value and value.startswith("gAAAAA"):
                        decrypt(value)  # Fail closed on corrupt/wrong-key historical data.
                    elif value:
                        if field == "profile_context" and "[writing_style]" in value:
                            value, style = value.split("[writing_style]", 1)
                            value = value.rstrip().rstrip("-").rstrip()
                            if not row.writing_style:
                                row.writing_style = encrypt(style.strip())
                        setattr(row, field, encrypt(value))
        await session.commit()
    await _engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
