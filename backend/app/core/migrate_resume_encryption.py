"""
One-time migration: encrypt plaintext UserResume rows.

Safe to run multiple times — rows already encrypted (Fernet token starts with "gAAAAA")
are skipped. Plaintext rows are detected by the absence of that prefix and are
encrypted in-place.

Run via: python -m app.core.migrate_resume_encryption
Add to docker-compose as a pre-startup step or run manually once before first deploy.
"""

import asyncio
import sys

# Ensure the app package is on the path
sys.path.insert(0, "/app")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.crypto import encrypt, decrypt


FERNET_TOKEN_PREFIX = "gAAAAA"


async def migrate():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Load all resume rows
        result = await session.execute(
            text("SELECT id, raw_text, structured_summary FROM user_resumes")
        )
        rows = result.fetchall()

        if not rows:
            print("No resume rows found. Nothing to migrate.")
            return

        encrypted_count = 0
        plaintext_count = 0
        skipped_count = 0

        for row in rows:
            row_id, raw_text, structured_summary = row
            updated = False

            # Migrate raw_text if it's not already a Fernet token
            if raw_text and not raw_text.startswith(FERNET_TOKEN_PREFIX):
                encrypted_text = encrypt(raw_text)
                await session.execute(
                    text("UPDATE user_resumes SET raw_text = :text WHERE id = :id"),
                    {"text": encrypted_text, "id": str(row_id)},
                )
                plaintext_count += 1
                updated = True

            # Migrate structured_summary if it's not already a Fernet token
            # (also skip if it's valid JSON already — old plaintext format)
            if structured_summary:
                is_encrypted = structured_summary.startswith(FERNET_TOKEN_PREFIX)
                is_valid_json = False
                if not is_encrypted:
                    try:
                        import json
                        json.loads(structured_summary)
                        is_valid_json = True
                    except Exception:
                        pass

                if is_encrypted:
                    skipped_count += 1
                elif is_valid_json:
                    # Plaintext JSON — encrypt it
                    encrypted_summary = encrypt(structured_summary)
                    await session.execute(
                        text("UPDATE user_resumes SET structured_summary = :summary WHERE id = :id"),
                        {"summary": encrypted_summary, "id": str(row_id)},
                    )
                    encrypted_count += 1
                    updated = True
                else:
                    # Garbled/unreadable — leave as-is so it doesn't break the app
                    # Log it for manual review
                    print(f"Row {row_id}: structured_summary is neither Fernet nor JSON. Skipping.")

            if updated:
                await session.commit()

        print(
            f"Migration complete: {plaintext_count} raw_text rows encrypted, "
            f"{encrypted_count} structured_summary rows encrypted, "
            f"{skipped_count} already encrypted rows skipped."
        )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
