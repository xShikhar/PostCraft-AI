#!/bin/sh
set -e

echo "==> Running database migrations with Alembic..."
MAX_RETRIES=5
RETRY_COUNT=0
until alembic upgrade head; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "FATAL: Database migrations failed after $MAX_RETRIES attempts."
    exit 1
  fi
  echo "Migration failed (attempt $RETRY_COUNT/$MAX_RETRIES). Waiting 2s for DB to be ready..."
  sleep 2
done

if [ "${RUN_RESUME_MIGRATION:-false}" = "true" ]; then
  echo "==> Running one-time resume encryption migration..."
  # Safe to re-run: already-encrypted rows are skipped. Won't block on failure.
  python -m app.core.migrate_resume_encryption || echo "WARNING: Resume encryption migration failed. Existing plaintext rows are still readable — investigate and re-run manually."
fi

PORT_TO_USE="${PORT:-8000}"
echo "==> Starting FastAPI with uvicorn on port $PORT_TO_USE..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT_TO_USE"
