#!/bin/sh
set -e

echo "==> Running database migrations with Alembic..."
alembic upgrade head

PORT_TO_USE="${PORT:-8000}"
echo "==> Starting FastAPI with uvicorn on port $PORT_TO_USE..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT_TO_USE"
