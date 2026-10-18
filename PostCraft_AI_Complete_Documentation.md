# PostCraft AI implementation reference

Updated 15 October 2026. See DEPLOYMENT_ARCHITECTURE.md for settings, DEPLOYMENT.md for release operations, PROJECT_STATUS_REPORT.md for the historical audit and FIX_VERIFICATION.md for current checks.

## Request path and learning

The Next.js composer posts topic, raw thoughts, platform, optional background override and context toggle with a JWT. FastAPI authenticates, applies user/IP budgets, acquires bounded capacity, locks the user for atomic daily admission and creates a generation.

PostGenerationPipeline compiles a real six-node StateGraph: research, pattern_extraction, draft_generation, quality_check, increment_retry and save_generation. Hard quality failures loop through increment_retry back to drafting, at most twice. Soft or unavailable checks save needs_review; errors save failed. Retries reuse research and only request failed draft fields.

Research checks a hashed-topic cache valid for 24 hours. Tavily then SerpApi are attempted, including outage/empty-result fallback. Both Tavily raw and summary fallback content are capped at 1,500 characters per result (up to five per search). Cache preserves provenance/confidence/URLs; synthetic structural examples remain low confidence, are never cached, and cannot ground personal numbers.

Pattern extraction retrieves timestamp-ordered styles. Empty/unavailable Chroma falls back to PostgreSQL. Recency means prompt emphasis, not trained model weights or cosine retrieval. Draft prompts use recent encrypted Preferences plus explicit writing instructions. Optional resume summary, about-me and background notes are gated by use_context; writing-style instructions remain independent.

Drafts, original draft evidence, research and quality metadata are committed before response. Failed responses explicitly use status failed, and the browser checks complete drafts before selection. Edits use bounded async structured calls and shared checks. Hard-failing revisions are rejected; soft misses remain needs_review. Finalization rechecks quality, prevents changing a locked selection, commits a user-derived StyleProfile and encrypted Preference, and preserves per-draft chat history. Chroma indexing is asynchronous; PostgreSQL learning is committed before returning.

## Quality policy

Deterministic checks cover originality (two matching 8-word n-grams or a 10-word run), structural tells/em-dash density, banned phrases, and unsourced personal numeric claims with unit/currency/magnitude-preserving matching. Placeholder/year exemptions remain. Unsupported generic thresholds require review; real public research can ground general metrics, but not personal achievements; these regex checks cannot prove ownership of an achievement or semantic factual accuracy.

The judge receives original inputs and research provenance to check grounding, completeness, CTA and substance. Judge failure/missing score is not a pass. A score below 7 is a soft miss; grounding/banned failures are hard. The score estimates the draft set, not each draft individually. Human review remains necessary.

## API contracts

| Route | Behavior |
|---|---|
| POST /api/auth/signup | Normalized username, password, agreed_to_terms/current terms_version and optional remember_me; stores consent. |
| POST /api/auth/login | Form credentials/optional remember_me. |
| GET/PATCH/DELETE /api/users/me | Profile, independently encrypted private fields, account deletion. |
| GET /api/users/me/style-profile | Current style/history, optional platform. |
| POST/GET/PATCH/DELETE /api/users/me/resume | Bounded upload, view/edit/reanalyze extracted text, remove. |
| GET /api/users/me/export | Profile, resume, preferences, styles, generations and chats. |
| POST/GET /api/generations | Generation or owner-scoped q/platform/limit/offset history. |
| GET /api/generations/metrics | Aggregate counts and recent timestamps for cadence. |
| GET /api/generations/{id}/full | Owned drafts/chats/research/quality. |
| POST /api/generations/{id}/edit | Selected draft revision and quality checks. |
| POST /api/generations/{id}/finalize | Validates, locks and learns final writing preferences. |
| GET /api/admin/stats | Protected counts. |
| GET /api/admin/users | Protected paginated user search without credentials/private profile. |
| GET /api/admin/users/{id}/generations | Audited user inspection. |
| GET /api/admin/cost-summary | Protected estimated cost/token totals. |
| GET /api/admin/audit-logs | Protected paginated access/CLI audit. |
| GET /api/health and /api/health/db | Public liveness/minimal readiness; failure returns 503 without exception text. |

There is no HTTP role-changing API. Only python -m app.cli.make_admin USER [--revoke] grants/revokes roles. ADMIN_USERNAMES has no effect. Authenticated admin access/denials and CLI grants/revocations are audited; anonymous network traffic is not a comprehensive audit ledger.

## Frontend

Seven distinct experiences: sign-in, home, composer, selection, editor, history, profile/voice. Privacy/terms work before login; admin is a separate protected page. Header search uses the shared API and workspace open callback. History supports search/filter/date grouping/paging. Home uses aggregate metrics and direct quick capture. Identity changes remount workspace state and stale responses are ignored.

Profile saves are independent. Learned style, editable extracted resume text and JSON export are visible. Remember is wired to seven-day session storage or 30-day local storage. Forgot-password/Status placeholders and fabricated notification/voice indicators were removed; no reset-email service is claimed. The loading UI shows elapsed time without fake percentages. Theme buttons map violet/white and coral/charcoal logos; Lato/Merriweather remain. One theme-aware toaster is mounted in the layout. Scoped GSAP cleanup and CSS reduced-motion behavior remain.

## Data and operations

Fernet encrypts private profile fields, resume text/summary, Preferences and context snapshots. Drafts/raw thoughts/chats/style descriptions remain normal application data requiring protected storage/backups. Startup validates keys and encrypts legacy fields; corrupted tokens fail rather than returning plaintext.

Files are capped at 5MB, text at 100,000 characters, PDFs at 50 pages and DOCX expansion at 10MB. TXT/Markdown must be UTF-8. Critical writes are awaited; optional indexing/cache/cost tasks use isolated sessions and up to 20 seconds of shutdown draining. Cost records include ownership/model and cover calls with reported usage, including resume and synthetic research. Model-specific rates are configurable assumptions, not a model-pricing catalog. Backoff has two wrapper retries/full jitter capped at three seconds, SDK retries disabled and recognized permanent-quota fail-fast. Telemetry separates attempts from sleep.

Deletion removes relational data and queues durable vector erasure, returning pending wording on external failure. Expired research is periodically removed and cache topic keys are hashed. Legal/operator identity, live TLS/quotas, backups and exclusion-list compliance require external verification. Tests are isolated from local/live databases and external HTTP.
