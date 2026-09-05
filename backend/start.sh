#!/bin/sh
set -e

echo "==> Running database migrations with Alembic..."
alembic upgrade head

echo "==> Running one-time resume encryption migration (if needed)..."
# Safe to re-run: already-encrypted rows are skipped. Won't block on failure.
python -m app.core.migrate_resume_encryption || echo "WARNING: Resume encryption migration failed. Existing plaintext rows are still readable — investigate and re-run manually."

PORT_TO_USE="${PORT:-8000}"
echo "==> Starting FastAPI with uvicorn on port $PORT_TO_USE..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT_TO_USE"
