# ─── Stage 1: Build dependencies ─────────────────────
FROM python:3.12-slim AS builder

# poppler-utils is required by pdfplumber for PDF text extraction.
# Without it, PDF processing silently falls back to raw text (broken).
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        poppler-utils \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

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

# poppler-utils (for pdfplumber) and libpq5 (for psycopg2) are runtime deps.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        poppler-utils \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

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
RUN chmod +x /app/start.sh && python -m compileall -q /app

EXPOSE 8000

CMD ["/app/start.sh"]
