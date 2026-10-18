# Deployment and release checks

Use DEPLOYMENT_ARCHITECTURE.md for the separate managed and self-hosted paths and complete environment matrix. Primary production is Render + Vercel + Supabase.

## Before releasing this remediation

1. Back up PostgreSQL and verify restore access. Preserve the current Fernet key; do not replace it blindly.
2. Supply DATABASE_URL, verified public-database TLS, random JWT_SECRET_KEY, valid RESUME_ENCRYPTION_KEY and Gemini credentials. Configure actual CORS origins/API hosts and remove ADMIN_USERNAMES.
3. Review existing admins and revoke unintended grants with the CLI. Rotate any signing/database/provider credentials that used historical public defaults or were exposed. Encryption-key rotation needs controlled re-encryption with the old key.
4. Resolve case-insensitive username collisions. Container startup applies a2d4e6f8b0c1 and encrypts legacy private fields before serving. A collision or corrupted ciphertext stops startup rather than losing data.
5. Build frontend with correct NEXT_PUBLIC_API_URL and deploy both contracts together: signup consent and profile fields changed.
6. Run isolated tests and frontend lint/type/build checks. In staging verify actual models/quotas, PostgreSQL locking/TLS, CORS, rate headers, account switching, finalized history and erasure retries.
7. Supply real operator/support details and review privacy/terms for your actual processors/jurisdiction. The repository cannot invent business identity, legal review or processor agreements.
8. Configure monitoring, backup/restore and billing alerts. Cost logs are configurable estimates, not invoices.

## Managed path

Use backend/render.yaml with its explicit backend root/context and external Supabase session-pooler URL. DATABASE_SSL=True enables verified TLS. Vercel gets its public Render API origin. Change the example service domains to match dashboards. Internal Docker names do not belong in browser API configuration.

## Self-hosted path

Use production Compose with strong POSTGRES_* credentials and POSTCRAFT_DOMAIN/POSTCRAFT_ADMIN_EMAIL. Only Caddy publishes ports. The app domain is included in FastAPI allowed hosts. Database traffic is on the private container network; PostgreSQL TLS must be configured separately if required. There is no POSTCRAFT_SKIP_TLS switch.

## Guarantees and limits

JWT and Fernet validation fail closed. Owned endpoints authorize by authenticated user; admin requires is_admin, changed only by CLI with audit. Signup stores consent version/time. The actual Next document gets nonce-based CSP separately from API response headers.

Queue timeout happens before inserting a generation. Auth limits are per IP; costly writes use user keys. In-memory rate storage requires one backend process/replica. Shared storage requires a supported driver and staging verification before scaling.

Deletion commits SQL cleanup and a durable vector erasure job together. HTTP 200 means immediate vector cleanup succeeded; HTTP 202 means it will retry. Background vector writes lock/check the live user before mutation. Pending jobs retry every 30 seconds/after restart. External outages can delay erasure. Audit records survive with account references nulled; backup/provider retention remains operational work.

Compose now pins Chroma 1.5.9 to match uv.lock and mounts /data. Existing 0.5 volumes require an explicit backed-up Chroma migration before switching images; never apply a version change blindly to the only copy of a vector store. PostgreSQL retains the style descriptions for re-indexing. See https://docs.trychroma.com/deployment/docker and https://docs.trychroma.com/updates/migration.

Rolling back code after schema/encryption changes needs compatibility review. Do not run old plaintext-profile code against encrypted fields. Restore a coherent application/database snapshot if necessary.
