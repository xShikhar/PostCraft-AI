# Deployment Checklist — Pre-Launch

This document tracks deployment-level security work that **must happen before
opening the app to real consumers**. Items marked ✅ are done in the repo.
Items marked ⚠️ still need work — most are infrastructure / policy / legal
decisions made at deploy time, not code changes.

If you can tick every box before opening signup, you're good to ship.

---

## In-process (done in this repo)

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | JWT secret fails closed if `JWT_SECRET_KEY` is missing or weak (≥32 chars) | ✅ Done | `backend/app/core/security.py:7–23` |
| 2 | Hardcoded JWT secret fallback removed; new random secret in `backend/.env` | ✅ Done | `backend/.env`, `docker-compose.prod.yml` |
| 3 | Database port no longer published in prod compose (was `5432:5432`) | ✅ Done | `docker-compose.prod.yml` — `postgres` service |
| 4 | Per-IP rate limits on auth: 5/min login, 3/min signup | ✅ Done | `backend/app/api/auth.py:58–60, 82–84` |
| 5 | XSS sanitization on AI-generated draft content | ✅ Done | `frontend/src/app/page.tsx:36` (DOMPurify) |
| 6 | Security response headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | ✅ Done | `backend/app/main.py:50–58` |
| 7 | TrustedHost middleware against Host header attacks | ✅ Done | `backend/app/main.py:54–56` |
| 8 | Frontend dependency CVEs patched (postcss / sharp via next 16.3.4) | ✅ Done | `frontend/package.json` |
| 9 | DB connection TLS (`sslmode=require`) in prod | ✅ Done | `docker-compose.prod.yml:47` |
| 10 | Cost-control rate limits on generation: 10/hour draft, 20/hour edit, 30/hour finalize | ✅ Done | `backend/app/api/generations.py:15`, `editor.py:17, 99` |
| 11 | Resume PII encrypted at rest (Fernet, `RESUME_ENCRYPTION_KEY` env) | ✅ Done | `backend/app/core/crypto.py`, `users.py` upload + read paths, `nodes.py` pipeline read path |
| 12 | Account deletion cascades: DB (resume, style profiles, projects, generations, chat history, preferences) + ChromaDB vectors | ✅ Done | `backend/app/api/users.py:delete_my_account`, `vector.py:delete_all_for_user` |
| 13 | Account deletion exposed as `DELETE /api/users/me` | ✅ Done | `backend/app/api/users.py` |
| 14 | Resume encryption one-time migration (encrypt existing plaintext rows) | ✅ Done | `backend/app/core/migrate_resume_encryption.py`, wired into `start.sh` |
| 15 | Sentry SDK wired into `main.py` (activate with `SENTRY_DSN` env var) | ✅ Done | `backend/app/main.py:20–43` |
| 16 | TLS termination: Caddy compose service + config with Let's Encrypt auto-renewal | ✅ Done | `docker-compose.prod.yml` (caddy service), `frontend/Caddyfile` |
| 17 | Backend/frontend no longer publicly exposed (only Caddy has public ports) | ✅ Done | `docker-compose.prod.yml` — backend/frontend ports removed |
| 18 | Privacy policy + ToS starting draft | ✅ Done | `PRIVACY.md` — needs real legal review before relying on it |
| 19 | GDPR notes | ✅ Done | `PRIVACY.md` (GDPR section) |

---

## Pre-deploy checklist (handle at actual deploy time)

### ⚠️ Item A: TLS — already wired, just needs domain + email

The Caddy config and compose service are in place. You still need to:

1. Set `$POSTCRAFT_DOMAIN` (e.g. `app.yourdomain.com`) and
   `$POSTCRAFT_ADMIN_EMAIL` in your env / secrets manager.
2. Point DNS for `$POSTCRAFT_DOMAIN` to your server's public IP.
3. Confirm ports 80 + 443 are open to the internet on the host.
4. Run `docker compose -f docker-compose.prod.yml up -d`.
5. Caddy auto-issues the Let's Encrypt cert within ~30 seconds.
6. Verify: `curl -sI https://$POSTCRAFT_DOMAIN/api/health`

Set a calendar reminder 30 days from now to confirm the cert renewed
automatically. Caddy sends expiry notices to `$POSTCRAFT_ADMIN_EMAIL`.

### ⚠️ Item B: Sentry — needs a DSN

1. Create a Sentry project at sentry.io (free tier covers this).
2. Copy the DSN — it looks like `https://xxxxx@o123.ingest.sentry.io/456`.
3. Add `SENTRY_DSN=https://...@o123.ingest.sentry.io/456` to your env.
4. Rebuild the backend image. Done.

### ⚠️ Item C: Gemini billing alert — no code change

Set this in the Google AI Studio console:
1. Go to Google AI Studio → quota and billing.
2. Set a budget alert at e.g. $20/month, with email notification.
3. The rate limits (10 gen/hour) cap per-user abuse but you still need
   the billing alarm for aggregate cost surprises.

### ⚠️ Item D: Postgres password — rotate before first public deploy

Set `POSTGRES_PASSWORD` to a strong random value in your env/secrets
manager. Update `docker-compose.prod.yml` to use the env var (already wired).

### ⚠️ Item E: httpOnly cookie + CSRF

Optional but recommended. See `PRIVACY.md` for the full migration path.
Acceptable to defer if you're comfortable with the localStorage risk at
your current scale.

### ⚠️ Item F: Privacy policy + ToS

`PRIVACY.md` has a starting template. **You need to:**
1. Replace all `[your domain]`, `[your jurisdiction]`, `[your company address]` etc.
2. Get a real legal review before relying on it.
3. Link it from the signup/login page.
4. Update the "Effective date" once you've reviewed and confirmed it.

### ⚠️ Item G: Gemini data-use terms confirmation

Before launch, read Google's Gemini API terms to confirm your usage
is within them. The key question: does sending resume text + writing
style + draft content through the API violate their prohibited use
policy? (It shouldn't, but read the actual document to be sure.) The
URL is in `PRIVACY.md` in the sub-processors section.

### ⚠️ Item H: Soft launch

Invite a small group first. Watch:
- Sentry for errors
- Gemini billing alerts
- `/api/health` uptime
- Rate limit hits (429s) — might indicate abuse or a user hitting a genuine limit

XSS gives the attacker `localStorage.getItem("postcraft_token")` and full
account takeover. DOMPurify is the first line of defense; httpOnly cookies
break the XSS → token theft chain entirely.

**Minimum acceptable:** Leave as-is for now **only if** you accept the
tradeoff (small user base, you control the codebase, you trust the
DOMPurify setup, no third-party scripts injected). Document the
acknowledgment somewhere your team can find it.

**Preferred:** Migrate `/api/auth/login` and `/api/auth/signup` to set the
JWT as a `Set-Cookie: HttpOnly; Secure; SameSite=Strict; Path=/` cookie.
Update `frontend/src/lib/api/client.ts` to use `credentials: 'include'`
and drop the `Authorization: Bearer` header. Add a `GET /api/auth/me` or
similar to confirm the cookie works on the server. For CSRF, `SameSite=Strict`
covers most cases; if you need cross-site flows, add a double-submit
CSRF token.

**Files to touch when you do this:** `backend/app/api/auth.py`,
`backend/app/main.py` (cookie middleware), `frontend/src/lib/api/client.ts`,
`frontend/src/features/auth/hooks/use-auth.ts`.

---

### ⚠️ Item C: Postgres password rotation + secrets management

**Why it matters:** The default password in `docker-compose.prod.yml` is
`postcraft` (the same as the dev default). This is a publicly known value
once the image is public. Even with the port no longer published, the
container's env vars are visible if anyone gets a shell inside.

**Minimum acceptable:** Set `POSTGRES_PASSWORD` to a strong random value
in the env / secrets manager, **before** the first deploy. Re-roll it
anytime the database host is recycled.

**Preferred:** Use Docker secrets, AWS Secrets Manager, HashiCorp Vault,
or your platform's managed secret store. Rotate on a schedule.

---

### ⚠️ Item D: Privacy policy + Terms of Service (legal)

**Why it matters:** You're storing resumes, writing samples, and inferred
style profiles about real people. At minimum, tell them what you collect,
why, and how long you keep it. Terms of service should cover ownership of
generated content, acceptable use, and account termination.

**Status:** Not done. There is no `PRIVACY.md` or `TERMS.md` in this repo.

**Minimum acceptable:** Draft a privacy policy and ToS using a public
template (e.g. from a privacy-policy-generator service) and link them from
your signup page. Have a real legal review at the point you take payment
or cross ~1,000 active users — both thresholds are reasonable to delay
legal review past.

**Related work I can do here on request:** I can write a first-draft
template based on what the app actually does (resume upload, profile
context, generation history, no payment, no third-party analytics yet).
Just ask. **I am not a lawyer and a generated template is not legal
advice — get a real review before relying on it.**

---

### ⚠️ Item E: GDPR / data-protection compliance

**Why it matters:** If you have any users in the EU/UK, GDPR applies
regardless of where you're based. The technical pieces are mostly in place
now (account deletion cascades, encrypted PII, no third-party data
sharing) but you still need:

- **Lawful basis** declared in your privacy policy
- **Data export endpoint** (`GET /api/users/me/export` — gives the user a
  JSON of their account, generations, style profile) — easy to add on
  request
- **Data Processing Agreement with Google** — Gemini is a sub-processor
  for the resume text you send it. Read Google's API terms to confirm
  your usage is within their data-use terms (it should be — the
  `google-genai` client uses the Gemini API under your API key, which
  Google's terms cover, but read the actual document to be sure).
- **Cookie banner** — only required if you use anything beyond strictly
  necessary cookies. With localStorage JWT + no analytics, you're fine
  without one *unless* you add analytics later.

---

### ⚠️ Item F: Operational readiness

Not code, but real launch blockers:

- **Error monitoring** (Sentry or similar) — know when something breaks
  before users tell you
- **Uptime monitoring** — at minimum a health-check ping (you already
  have `/api/health`)
- **Database backups** — automated AND tested (restore once to confirm)
- **Gemini cost monitoring** — the rate limits I added (10 gen/hour) are
  a guardrail, not a billing alarm. You still need to track aggregate
  cost and set a real budget alert
- **Support channel** — even just a `support@yourdomain.com` mailbox

---

### ⚠️ Item G: Soft launch

Don't flip signup on for the general public in one step. Invite a small
number of real users first (waitlist, friends, a subreddit), watch error
monitoring and cost during that window, and only then widen.

---

## When you're ready to ship

1. ✅ All "In-process" items in the table at the top are done in the repo.
2. ⏭️ Work through Items A → G above. Items A, C, and F are non-negotiable
   for a public consumer launch. Items B, D, E have "minimum acceptable"
   versions documented above.
3. 🚀 Deploy.
4. 📋 After deploy, re-run `pip-audit` and `npm audit --audit-level=high`
   on a clean tree — new CVEs land every week. The frontend has zero
   high-severity vulns as of the last scan; the backend's transitive
   warnings (gitpython via alembic, pip/setuptools in `python:3.12-slim`)
   are remediated by rebuilding with the latest base image.

