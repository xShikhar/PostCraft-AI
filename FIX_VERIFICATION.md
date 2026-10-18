# PostCraft remediation and verification

Updated 15 October 2026. This records fixes to the historical audit in `PROJECT_STATUS_REPORT.md`. Changes are local and uncommitted; no live application database was migrated, no production secrets were changed, and nothing was deployed or pushed.

## Coverage of all 26 findings

| Finding | Repository change |
|---|---|
| 1 — Admin escalation | Removed environment promotion from signup, login and authentication. CLI-only grants/revocations are audited. Usernames normalize consistently and have a case-insensitive unique index. Existing deployed admin memberships still need operator review. |
| 2 — Settings/sample mismatch | Modeled documented settings and deliberately ignored obsolete dotenv fields. Added current backend/frontend examples and optional model-specific token-rate configuration. |
| 3 — Render configuration | Explicit backend root/context, Supabase URL input, exact documented service origins, verified database TLS option and startup migration handling. Removed the unsupported release field and managed-Render-database contradiction. |
| 4 — Unused learning/wrong recency | Recent encrypted Preferences now enter draft prompts. Finalization compares the generation's original and final content and commits a learned StyleProfile and Preference. Retrieval and pruning use timestamps; Chroma failure falls back to PostgreSQL. Learned profiles are indexed asynchronously without duplicate SQL rows. |
| 5 — Quality pass on failure | Judge outages, parse failures, absent scores and scores below 7 require review. Every quality result resets failure state. Banned phrases have a deterministic gate and shared category contract. |
| 6 — Fabricated grounding | Cache preserves source/confidence/URLs and uses hashed topic keys. Synthetic structure is never cached or treated as factual evidence. Legacy provenance-free cache entries are discarded by migration. Numeric matching preserves units/currency/magnitude and separates personal evidence from public research; the judge sees inputs/provenance. |
| 7 — Editing bypass/blocking | Editing/finalization use bounded async model calls and the shared gates. Editing receives original inputs, enabled background, writing instructions and selected-draft chat. Author-provided revision facts remain available when finalizing. Hard-failing revisions are rejected; soft misses are marked for review. |
| 8 — Failure contract | Explicit `failed` status and error; frontend rejects incomplete/failed responses before rendering selection. |
| 9 — Account state leakage | Identity changes remount the workspace. The API client discards stale responses and clears both token stores on logout. |
| 10 — Private context/toggle | About-me, profile background and writing instructions are separate encrypted fields. Optional personal context is disabled by the toggle; writing instructions remain independently active. |
| 11 — Encryption failure behavior | Fernet is validated at startup; wrong/corrupt ciphertext fails closed. Startup encrypts legacy private fields before serving, including old combined style notes and Preferences. Migration is idempotent and aborts on unreadable ciphertext. |
| 12 — Incomplete deletion | SQL cleanup and a durable vector-erasure job commit together. External failure returns HTTP 202/pending wording and is retried after restart/every 30 seconds. Vector writers lock/check the live user before mutation. Cost records are owned and deleted, including resume costs. |
| 13 — Profile overwrite | Independent fields and saves preserve background and writing style. Resume text is editable/reanalyzable; learned style and data export are visible. |
| 14 — Header search | Uses configured API origin, server search, correct generation ID and the workspace's reopen callback. Removed nonexistent-route navigation and swallowed search errors. |
| 15 — Home metrics/capture | Dedicated aggregate metrics replace the invalid/truncated history request. Capture passes text directly to composer. Counts distinguish generation attempts/in-progress/finalized; timestamps say Created rather than Edited. |
| 16 — History gaps | Added search, platform filters, date groups and paging. Finalized chats are retained. Sources and quality metadata persist and reload; stale sources are cleared. |
| 17 — Input/resource validation | Credential bounds, matching topic/schema limits, incremental 5MB upload cap, strict UTF-8/type checks, 50-page PDF and expanded-DOCX/text budgets. Untrusted extraction runs in a child process with a 15-second wall timeout; production Linux also applies CPU/memory limits. |
| 18 — Limit scope/headers | Auth remains per IP; costly writes use normalized authenticated-user keys, including resume/profile writes. Daily admission is serialized in PostgreSQL. Retry/rate headers are generated and CORS-exposed. Shared storage is configurable; the default memory store requires one process/replica. |
| 19 — Audit gaps | Authenticated admin access/denials and CLI privilege changes are recorded. Actor/target references are nulled on deletion while records remain. Added paginated audit browsing and user pagination. No HTTP role-changing API was introduced. |
| 20 — Security/privacy claims | Nonce CSP protects actual Next documents; production HSTS and verified public PostgreSQL TLS are supported. Error events/logs omit user content/provider error bodies; HTTP URL logging is suppressed. Server records signup agreement version/time. Legal copies were reconciled with real storage, retention, browser tokens and pending erasure. |
| 21 — Lifecycle gaps | Queue admission precedes row creation; cancellation/errors mark failure and generation has a 300-second deadline. Restart worker reconciles abandoned attempts older than ten minutes. Critical drafts/learning are awaited; optional tasks drain on shutdown. Chroma HTTP initialization and requests have bounded timeouts. |
| 22 — Build/data packaging | Backend installs from frozen `uv.lock`, pins uv and copies explicit application files. Data directories are excluded; shell/Dockerfile line endings are enforced. Compose Chroma 1.5.9 matches the locked client and uses `/data`. |
| 23 — Unsupported controls/promises | Remember is wired to seven-day session storage or 30-day local storage. Removed no-op Forgot-password/Status and fabricated notifications/voice labels. Loading shows elapsed time rather than a simulated stage percentage; encryption wording matches implementation. |
| 24 — Telemetry/cost gaps | Model attempts and backoff sleep are separate; SDK retries are disabled. Recognized permanent quota errors fail fast. Generation, edit, finalize and resume operations are timed; reported usage also covers synthetic research. Cost rows include ownership/model and configurable model-specific estimated rates. |
| 25 — Polish/dead code | Removed per-move layout reads and superseded modal/cache/similarity paths; vector pruning is actually used. One theme-aware toaster remains. GSAP callbacks are scoped/cleaned up; reduced-motion behavior covers CSS and interactions. |
| 26 — Diagnostics | Database readiness returns 503 with minimal status; exception details remain private. |

Core implementation: [authentication](<C:/Project/Ai post/backend/app/api/auth.py>), [generation/quality](<C:/Project/Ai post/backend/app/services/pipeline/nodes.py>), [editing/learning](<C:/Project/Ai post/backend/app/api/editor.py>), [private data/deletion](<C:/Project/Ai post/backend/app/api/users.py>), [migration](<C:/Project/Ai post/backend/alembic/versions/a2d4e6f8b0c1_audit_remediation.py>), [workspace](<C:/Project/Ai post/frontend/src/app/page.tsx>), [document CSP](<C:/Project/Ai post/frontend/src/proxy.ts>).

## Additional defects found during verification

- Fixed a preview-modal render loop that crashed Home after login, caused by comparing an absent item ID with `null` on every render. Added keyboard focus trapping/restoration.
- Fixed long usernames overflowing the mobile greeting.
- Aligned the Chroma client/server major versions and storage path. Added a tested timeout shim because the pinned SDK disables HTTP timeouts and restricts implementation names. Re-run its compatibility test before upgrading Chroma.
- Used the supported Webpack production builder after Windows Turbopack failed to establish its compiler subprocess connection. The production build now succeeds through the normal `npm run build` script.

## Verification performed

- Backend regression suite: **56 passed**, with two third-party deprecation warnings (Starlette/Argon2). Includes real graph execution with fake providers, authorization/consent/casing, encryption/startup failures, learning retrieval/recency, targeted retry schema, fail-closed quality, revision grounding, queue/failure contracts, rate headers, deletion outbox, restart reconciliation, bounded Chroma HTTP, resume validation/cost ownership, and fresh/idempotent migration tests.
- Fixtures explicitly replace application database/keys/provider clients/monitoring/rate storage. External HTTP is blocked. Migration tests use disposable SQLite files; the application's existing databases are not accessed.
- Frontend TypeScript no-emit check: passed. `npm run lint`: passed. `npm run build` (Webpack): passed, including TypeScript and server-rendered route generation.
- Headless Chrome fixture workflow: passed for authentication, direct capture, distinct composer/selection/editor states, generation, editing, finalization, header search, filtered history, profile, light/dark themes, account switching, mobile overflow and nonce CSP. Every API request is intercepted; no live providers or user accounts are involved.
- `uv lock --check --offline` with a workspace cache: passed (147 packages). Both Compose configurations passed quiet validation without resolving real environment files. Render YAML parsed successfully. Python syntax and `git diff --check` passed.
- Google's [official model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) lists the configured `gemini-3.5-flash-lite` identifier as stable with structured-output support. This verifies the public identifier, not this account's credentials, quota or latency.

Reproducible checks: run `python -m pytest tests -q` in backend; run `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build` in frontend. For browser checks, start the built frontend with `npm run start -- -p 3131`, then run `npm run test:smoke` in another terminal. The smoke script uses an isolated browser context and fixture APIs; set `BROWSER_PATH` if Chromium is not installed through Playwright. Windows sandbox execution could not initialize local event-loop/compiler sockets, so the affected local tests/builds ran with approved access outside the sandbox.

## Deployment and information still required

These are operational or external facts, not changes that can be safely invented in source:

1. Back up and validate real PostgreSQL data, preserve the matching Fernet key, resolve any existing username collisions, and apply the new schema/encryption release deliberately. No real migration was run here.
2. Review existing deployed admins; removing auto-promotion does not retrospectively identify which historical grants were legitimate. Rotate exposed/default-derived signing/database/provider secrets. Encryption-key rotation needs controlled re-encryption.
3. Confirm dashboard API origins, CORS/hosts, Supabase TLS, provider keys/quota, persistent disk, monitoring, backup/restore and costs in staging. No live deployment or actual-provider latency benchmark was performed.
4. Back up/migrate an existing Chroma 0.5 volume before using the pinned 1.5 image. PostgreSQL retains style descriptions, but this task did not modify or migrate any existing vector data. Follow [Chroma's Docker documentation](https://docs.trychroma.com/deployment/docker) and [migration guide](https://docs.trychroma.com/updates/migration).
5. Supply the real operator identity, support contact, jurisdiction/processor arrangements and legal review before public release. Repository copy no longer claims these are already verified.
6. Provide the authoritative frontend exclusion list to verify that separate requirement. Assumptions used here: preserve finalized chats, keep all seven experiences distinct, gate personal background separately from writing instructions, and treat Render/Vercel/Supabase as primary while maintaining the self-hosted alternative.

Nonce CSP intentionally makes the document routes dynamic. SQLite/unit/browser fixtures do not prove production PostgreSQL concurrency, external erasure during a real outage, Docker image builds, every-device accessibility/performance or semantic truth of model output. The old audit remains historical; this file is the current remediation record.
