# ─── Stage 1: Build dependencies ─────────────────────
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Copy project metadata and install dependencies
COPY pyproject.toml ./

# Use uv to create a venv and install deps
RUN uv venv /app/.venv && \
    VIRTUAL_ENV=/app/.venv uv pip install -r pyproject.toml

# ─── Stage 2: Runtime ────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Copy the virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Put venv on PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application code and ensure start script is executable
COPY . .
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
