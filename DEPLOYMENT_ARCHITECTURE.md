# Deployment architecture and environment reference

Updated 15 October 2026. This describes repository configuration, not certification of live dashboards.

## Path A: primary managed deployment

Browser -> Vercel Next.js -> HTTPS Render API -> Supabase PostgreSQL session pooler and embedded Chroma on a Render persistent disk. Select backend/render.yaml as Blueprint path; rootDir: backend scopes the Dockerfile and context. Supply an external Supabase URL; this Blueprint does not provision Render PostgreSQL. Vercel needs build-time NEXT_PUBLIC_API_URL pointing to Render. Configure exact frontend CORS origins and API hostnames; change checked-in domain defaults if your dashboards differ.

## Path B: self-hosted VM

Caddy on ports 80/443 -> frontend and /api backend -> internal PostgreSQL/Chroma containers. Use docker-compose.prod.yml independently of the Blueprint. DOCKER_BUILD=true enables standalone Next packaging. Empty frontend API origin means same-origin behind Caddy. Caddy provides public TLS. Internal Compose PostgreSQL uses a private network and DATABASE_SSL=False; do not claim encrypted database traffic unless PostgreSQL TLS is separately configured.

## Environment matrix

| Variable | Requirement/default |
|---|---|
| DATABASE_URL | Required usable SQLAlchemy URL; postgres/postgresql schemes normalize to asyncpg. Supabase pooler details come from its dashboard. |
| DATABASE_SSL | False locally/internal Compose; True for managed public PostgreSQL. Uses default CA-verified TLS, including Alembic. |
| JWT_SECRET_KEY | Required, at least 32 characters; generate randomly. |
| RESUME_ENCRYPTION_KEY | Required valid Fernet key; generate with Fernet.generate_key(), never hexadecimal. Validated at startup/migration. Preserve the matching key for existing data. |
| GEMINI_API_KEY | Required for writing and resume analysis. |
| GEMINI_MODEL | Base model, default gemini-3.5-flash-lite. Verify availability in your provider account. |
| GEMINI_FAST_MODEL | Optional; blank/unset falls back to base. Extraction and judging. |
| GEMINI_DRAFT_MODEL | Optional; blank/unset falls back to base. Drafting and editing. |
| TAVILY_API_KEY / SERP_API_KEY | Optional; Tavily first, failure/empty fallback to SerpApi, then low-confidence synthetic structure. |
| CHROMA_HOST / CHROMA_PORT | Explicit nonlocal host selects HTTP client; otherwise embedded. Port default 8000. |
| CHROMA_PERSIST_DIR | Embedded directory, default ./chroma_data; Blueprint uses /var/data/chroma with disk. |
| CORS_ORIGINS | CSV/JSON origins; default http://localhost:3000. Retry/rate headers are exposed. |
| ALLOWED_HOSTS | CSV/JSON actual API hosts. Set deliberately for each path. |
| ENVIRONMENT / DEBUG | Defaults development / False. Production adds HSTS/production guards. |
| RATE_LIMIT_STORAGE_URI | Default memory:// requires a single process/replica. Shared storage requires its supported driver installed and staging verification. |
| SENTRY_DSN | Optional; reduced event IDs/types only. Payloads, breadcrumbs, locals and tracing disabled. |
| SENTRY_TRACES_SAMPLE_RATE | Accepted for compatibility; tracing remains disabled to avoid content-bearing spans. |
| MODEL_TOKEN_PRICES | Optional JSON mapping model names to prompt/completion rates per million tokens. |
| COST_PROMPT_PER_MILLION / COST_COMPLETION_PER_MILLION | Configurable estimate assumptions, defaults 0.30 / 2.50; not verified provider pricing or invoices. Match your model selection. |
| PORT | Listener, default 8000. |
| RUN_RESUME_MIGRATION | Compatibility setting; startup now always validates/encrypts legacy private fields. |
| NEXT_PUBLIC_API_URL | Frontend build-time API origin: HTTPS Render on Vercel, empty behind Caddy, localhost API in development. |
| DOCKER_BUILD | Frontend Docker flag; omit on native Vercel builds. |
| POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB | Required production Compose credentials. |
| POSTCRAFT_DOMAIN / POSTCRAFT_ADMIN_EMAIL | Caddy host/contact; host included in API allowed hosts. |

Unknown legacy dotenv keys are ignored for upgrade compatibility. ADMIN_USERNAMES cannot grant a role and should be removed from dashboards. Encryption-key rotation requires controlled re-encryption with the old key, not blind replacement.

## Startup/lifecycle

start.sh retries Alembic five times with two-second delays, then runs legacy private-field encryption before Uvicorn. Failures prevent startup. Current schema head: a2d4e6f8b0c1. Existing case-insensitive username collisions must be resolved; migration fails rather than merging accounts.

Critical drafts/preferences/learned styles commit before responses. Optional indexing/cache/cost tasks use isolated sessions and drain for up to 20 seconds at shutdown. A worker retries durable vector erasure jobs every 30 seconds, removes expired research rows and marks abandoned generating records older than ten minutes failed. PostgreSQL row locks coordinate admission and vector writes with deletion; disposable SQLite tests cannot prove production locking/TLS guarantees.
