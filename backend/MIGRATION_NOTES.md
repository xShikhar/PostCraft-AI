# PostCraft AI — LangGraph Cutover & Architecture Migration Notes

## Status: COMPLETE (Phases 1, 2, and 3 Finished)

The hand-rolled `orchestrator.py` and experimental `orchestrator_langgraph.py` have been completely removed.
The production pipeline now lives in **`backend/app/services/pipeline/`** as a modular LangGraph `StateGraph`.

---

## What Changed Structurally

### 1. Unified StateGraph Architecture
- Replaced monolithic, imperative `while`-loops with a compiled LangGraph `StateGraph`.
- Workflow transitions, conditional routing (cache-hit skip, error short-circuits), and quality retry loops are declared explicitly as graph edges.
- Nodes are implemented as typed async functions taking `(state: GraphState, deps: PipelineDeps)`.
- LangGraph async detection is preserved via an explicit async closure wrapper in `graph.py`.

### 2. Modular `pipeline/` Package Layout
```
backend/app/services/pipeline/
├── __init__.py          # Exports PostGenerationPipeline
├── deps.py              # PipelineDeps (session, llm, settings)
├── state.py             # GraphState TypedDict + Pydantic models (ExtractedPattern, GeneratedDrafts, QualityVerdict)
├── prompts.py           # Lead-Gen & Engagement prompt templates and builder functions
├── nodes.py             # 6 async worker node functions
├── graph.py             # StateGraph definition & conditional routers
├── pipeline.py          # PostGenerationPipeline runtime entrypoint
└── README.md            # LangGraph topology & developer guide
```

### 3. Core Layer Reorganization (`app/core/`)
- Infrastructure and configuration are decoupled into `app/core/`:
  - `app/core/config.py`: Settings & `.env` management via `pydantic-settings`.
  - `app/core/database.py`: Async SQLAlchemy engine, session maker, and `get_db`.
  - `app/core/security.py`: Password hashing (Argon2) and JWT token generation.

---

## What Changed Functionally: The Priority Framework

### 1. Lead-Generation CTA as Dominant Constraint
- Every generated draft must end with a conversion mechanism (e.g. DM invitation, discovery call booking, qualification question).
- Generic filler CTAs ("Thoughts?", "Agree?", "Let me know in the comments") are strictly prohibited.

### 2. User Profile Context Persistence
- Added `profile_context` column to the `User` model with Alembic migration `3451f9589925_add_profile_context_to_user.py`.
- Exposed `GET /api/users/me` and `PATCH /api/users/me` to read and update user profile settings.
- Wired `profile_context` into `GenerateRequest` with automatic database fallback.
- Added `ProfileSettingsModal` and profile textarea in the Next.js frontend.

### 3. Integrated Quality Check
- **Gate 1 (Originality)**: 6-word n-gram overlap check against research snippets.
- **Gates 2 & 3 (Lead-Gen CTA & Structural Completeness)**: Audited by Gemini 2.5 Flash returning a `QualityVerdict` model.
- Automatically routes failed drafts to `node_increment_retry` with specific failure feedback injected.

### 4. Research Engine Modernization
- `app/services/research.py` migrated off raw `google-genai` to `langchain-google-genai` (`ChatGoogleGenerativeAI`).
- Retained `google-genai` in `pyproject.toml` exclusively for conversational draft editing (`app/api/editor.py`).

---

## Graph Topology

```
START → node_research
  ├── [error] → node_save_generation → END
  ├── [cache hit + skip_extraction] → node_draft_generation → ...
  └── [normal] → node_pattern_extraction
                    ├── [error] → node_save_generation → END
                    └── [ok] → node_draft_generation
                                  ├── [error] → node_save_generation → END
                                  └── [ok] → node_quality_check
                                                ├── [PASS] → node_save_generation → END
                                                ├── [FAIL + retries < 2] → node_increment_retry → node_draft_generation (loop)
                                                └── [FAIL + retries >= 2] → node_save_generation → END
```

---

## Cost Logging & Token Accounting

All Gemini 2.5 Flash calls are logged to PostgreSQL `cost_logs` using `include_raw=True` on `.with_structured_output()`:
- **Input Tokens**: `$0.30 / 1M tokens`
- **Output Tokens**: `$2.50 / 1M tokens`

---

## Verification & Deployment Summary

1. **Unit & Integration Tests**: All test suites in `backend/tests/` passing (`test_auth.py`, `test_pipeline_graph.py`, `test_quality_checker.py`, `test_research.py`).
2. **Frontend Type Safety**: `npx tsc --noEmit` clean across Next.js 16 frontend.
3. **Containerized Stack**: Multi-stage Docker builds for backend and frontend validated; Alembic migrations run cleanly against PostgreSQL in Docker Compose; `/api/health` and `/api/health/db` verified.
