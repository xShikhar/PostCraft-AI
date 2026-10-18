# PostCraft AI maintainer map

Reconciled 15 October 2026. Read PostCraft_AI_Complete_Documentation.md for contracts, DEPLOYMENT_ARCHITECTURE.md for hosting/settings and DEPLOYMENT.md before release.

| Change | Main files |
|---|---|
| Authentication, consent, limits | backend/app/api/auth.py; core/security.py |
| Private fields and legacy encryption | core/crypto.py; core/migrate_resume_encryption.py; api/users.py |
| Schema | models.py and Alembic (head a2d4e6f8b0c1) |
| Research provenance/cache/failover | services/research.py; pipeline/background_tasks.py |
| State/routing | pipeline/state.py; graph.py; pipeline.py |
| Voice, CTA and judge policy | pipeline/prompts.py |
| Real gates/targeted retries | pipeline/nodes.py; originality.py; structural_checks.py; unsourced_numbers.py |
| Final learning and edit lifecycle | api/editor.py |
| Erasure retry/vector lifecycle | services/deletion.py; vector.py; background_tasks.py |
| Admin/audit | api/admin.py; cli/make_admin.py; frontend/src/app/admin/page.tsx |
| View flow/account isolation | frontend/src/app/page.tsx |
| Search/navigation/theme | components/layout/*; components/theme-provider.tsx |
| Home metrics/capture | features/home/components/home-view.tsx; api/generations.py |
| History filters/grouping | features/history/components/history-list.tsx |
| Profile/resume/export | features/profile/components/profile-page.tsx |
| API origin, 429, timeout/stale sessions | frontend/src/lib/api/client.ts |
| Document CSP | frontend/src/proxy.ts; app/layout.tsx |
| Legal copy | PRIVACY.md; frontend/src/features/legal/legal-content.ts |

Six graph nodes: research, pattern_extraction, draft_generation, quality_check, increment_retry, save_generation. Hard failures retry at most twice; soft/unevaluated quality saves needs_review. Edits/finalization use shared checks. The judge is fallible, so human review matters.

Final preferences and style are committed on finalization. Later prompts retrieve recent preferences; timestamp-ordered style has PostgreSQL fallback when Chroma is unavailable. This is prompt memory, not custom-model training.

Never grant admin through environment/signup. Never print key values while diagnosing configuration. Never replace an encryption key without an old-key re-encryption plan. Tests force disposable databases; production changes require release and staging checks.
