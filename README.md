# PostCraft AI

An AI-powered Content Research & Writing Assistant for LinkedIn and X (Twitter).

PostCraft researches public discussions on a topic, extracts **writing patterns** (structure, tone, pacing, storytelling technique, formatting, CTA style) — never content or phrasing — combines those patterns with the user's own raw ideas, and generates original draft posts. The user edits drafts conversationally, and the system gradually learns their personal writing style.

---

## Architecture

PostCraft uses an **Orchestrator-Agent** model. A single LLM-powered orchestrator dynamically calls specialized tools (Research, Style Extractor, Writer, Quality Checker, Editor, Memory) based on workflow state — not a rigid pipeline.

## Tech Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Backend      | FastAPI (Python 3.12)             |
| Frontend     | Next.js                          |
| ORM          | SQLAlchemy (async) + Alembic     |
| Primary DB   | PostgreSQL 16                    |
| Vector Store | ChromaDB                         |
| LLM          | Gemini 2.5 Flash                 |
| Web Search   | Brave Search API (Tavily fallback)|
| Container    | Docker + Docker Compose          |

---

## Local Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+ and npm
- [uv](https://docs.astral.sh/uv/) (Python package manager, optional for direct backend dev)

### 1. Clone and configure environment

```bash
cd backend
cp .env.example .env
# Edit .env — add your API keys (GEMINI_API_KEY at minimum)
```

### 2. Start services with Docker Compose

```bash
# From the project root
docker-compose up --build
```

This starts:
- **PostgreSQL** on port `5432`
- **ChromaDB** on port `8100`
- **FastAPI backend** on port `8000`

### 3. Verify the backend

```bash
curl http://localhost:8000/api/health
# → {"status":"healthy","version":"0.1.0","environment":"development"}

curl http://localhost:8000/api/health/db
# → {"status":"connected"}
```

### 4. Run the frontend (outside Docker)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 5. Run database migrations

```bash
# Inside the backend container or locally with the venv active
cd backend
alembic upgrade head
```

---

## Environment Variables

| Variable               | Required | Description                                    |
|------------------------|----------|------------------------------------------------|
| `DATABASE_URL`         | Yes      | PostgreSQL connection string (async)           |
| `GEMINI_API_KEY`       | Yes      | Google Gemini API key                          |
| `BRAVE_SEARCH_API_KEY` | No       | Brave Search API key                           |
| `TAVILY_API_KEY`       | No       | Tavily API key (fallback search)               |
| `CHROMA_HOST`          | No       | ChromaDB host (default: `localhost`)           |
| `CHROMA_PORT`          | No       | ChromaDB port (default: `8000`)                |
| `ENVIRONMENT`          | No       | `development` / `production`                   |
| `DEBUG`                | No       | Enable debug mode (default: `true`)            |
| `CORS_ORIGINS`         | No       | Allowed CORS origins (default: localhost:3000)  |

---

## Running Tests

```bash
cd backend
pytest -v
```

---

## Project Structure

```
postcraft-ai/
├── docker-compose.yml         # Local dev orchestration
├── README.md
├── .gitignore
├── backend/                   # FastAPI application
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/               # Database migrations
│   └── app/
│       ├── main.py            # FastAPI entrypoint
│       ├── config.py          # Settings (pydantic-settings)
│       ├── database.py        # Async SQLAlchemy setup
│       └── api/               # Route handlers
└── frontend/                  # Next.js application
    ├── package.json
    └── src/
```

---

## Build Phases

- [x] **Phase 0** — Foundation (monorepo, Docker Compose, hello-world)
- [ ] **Phase 1** — Database & Schema
- [ ] **Phase 2** — Research Tool
- [ ] **Phase 3** — Style Extractor
- [ ] **Phase 4** — Writer Tool
- [ ] **Phase 5** — Orchestrator Agent
- [ ] **Phase 6** — Quality Checker + Editor
- [ ] **Phase 7** — Memory
- [ ] **Phase 8** — Frontend (Next.js)
- [ ] **Phase 9** — Auth & Multi-user
- [ ] **Phase 10** — Deployment
- [ ] **Phase 11** — Testing & Hardening

---

## License

Proprietary — All rights reserved.
