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

echo "==> Validating encryption and migrating legacy private fields..."
python -m app.core.migrate_resume_encryption

PORT_TO_USE="${PORT:-8000}"
echo "==> Starting FastAPI with uvicorn on port $PORT_TO_USE..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT_TO_USE"
