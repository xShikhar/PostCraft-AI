# PostCraft AI

A Next.js writing workspace backed by FastAPI, a six-node LangGraph workflow, PostgreSQL, ChromaDB, Gemini and optional Tavily/SerpApi research. It produces LinkedIn and X drafts and learns preferences from finalized selections.

## Documentation

- DEPLOYMENT_ARCHITECTURE.md: primary Render/Vercel/Supabase path, separate self-hosted path and environment matrix.
- DEPLOYMENT.md: migration and release checks.
- PostCraft_AI_Complete_Documentation.md: current behavior/API contracts.
- PROJECT_STATUS_REPORT.md: historical audit of commit b31bf7d.
- FIX_VERIFICATION.md: remediation coverage and checks for this working tree.
- PRIVACY.md: current privacy/terms source mirrored in the frontend.

## Local development

1. Copy backend/.env.example to backend/.env; supply a random JWT secret, a valid Fernet key and Gemini credentials. Never commit .env.
2. Start local PostgreSQL and Chroma with docker compose up -d postgres chromadb. Local Compose starts three services (PostgreSQL, Chroma, backend); frontend runs separately.
3. In backend: uv sync --frozen; uv run alembic upgrade head; uv run python -m app.core.migrate_resume_encryption; then uv run uvicorn app.main:app --reload --port 8000.
4. In frontend: npm ci; set NEXT_PUBLIC_API_URL=http://localhost:8000; npm run dev.

Local Compose overrides start.sh and requires manual migrations. Production containers run schema and legacy-encryption migrations before accepting traffic. Primary production is Render/Vercel/Supabase; production Compose adds frontend and Caddy as an independent alternative.

## Behavior

Seven distinct experiences are sign-in, home, composer, selection, editor, history and profile/voice. History has search, platform filters, date grouping and paging. Drafts, chats, research provenance and quality metadata are saved. Finalization preserves chats and commits a learned style profile and encrypted Preference, which feeds later prompts. Scores are LLM estimates for a draft set, not independent per-draft scores or factual correctness guarantees.

Optional resume/about-me/background data is used only when context is enabled. Writing instructions remain independently active. Resume uploads/replacements, editing extracted text, independent profile saves and JSON data export are available. Supported files: UTF-8 TXT/Markdown, text PDF and DOCX; cap 5MB, 50 PDF pages, 100,000 extracted characters and 10MB DOCX expansion.

## Security and administration

Signup records current agreement version/time. Usernames are case-insensitive and passwords Argon2 hashed. Seven-day sessions use session storage; Remember creates a 30-day local-storage session. JWTs remain accessible to browser JavaScript. DOMPurify and nonce-based document CSP reduce injection risk; these are not HttpOnly cookies.

Private profile fields, resume text/summary, Preferences and context snapshots are Fernet encrypted. Drafts, raw thoughts, chats and style descriptions remain ordinary application data and require protected database access and backups.

Only python -m app.cli.make_admin USER [--revoke] changes admin roles. No environment allowlist or role-changing API exists. Authenticated admin access/denials and CLI changes are audited; actor/target references are nulled on account deletion while audit records remain.

Deletion commits owned SQL deletion and a durable vector erasure job. HTTP 202 means erasure is pending and will retry every 30 seconds and after restart. Backups and external processor retention are operator responsibilities.

## Verification

Backend: python -m pytest tests -q (in backend). Fixtures force disposable storage, mock providers and block outbound HTTP. Frontend: npm run lint; npx tsc --noEmit --incremental false; npm run build. See FIX_VERIFICATION.md for actual results and remaining staging checks.

## License

Proprietary; see LICENSE.
