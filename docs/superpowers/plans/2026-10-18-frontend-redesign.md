# Frontend Redesign Implementation Plan

> **For agentic workers:** Use executing-plans for integration and dispatching-parallel-agents for the independent backend, authentication, and profile/history domains. Track checks below.

**Goal:** Deliver the approved editorial redesign and complete real draft saving, deletion, navigation recovery, and setup workflows.

**Architecture:** Preserve FastAPI/SQLAlchemy and the centralized typed frontend API clients. Keep the root workspace dispatcher, add validated URL state and focused editor state, and reuse GSAP/Radix for motion and dialogs. Independent workers own disjoint files; the main agent integrates and reviews their work.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, GSAP, Radix, FastAPI, SQLAlchemy, Alembic.

**Spec:** `docs/superpowers/specs/2026-10-18-frontend-redesign-design.md`

## Global Constraints

- Work only on `frontend-redesign`; push that branch, never merge main.
- No fake controls, metrics, research, success states, or publishing claims.
- Preserve encrypted profile fields, authentication, ownership checks, rate limits, and finalized locks.
- No new state or animation dependencies; respect reduced motion and mobile input.
- Never commit secrets, runtime databases, uploaded files, or generated screenshots.
- API tests use disposable data; live provider verification is reported separately.

## Review Focus

1. Manual save from a stale tab must return a conflict without overwriting newer content (Task 1).
2. Account switching and refresh must not restore another user's private draft (Tasks 4, 5).
3. Saving, deleting, or loading failures must retain user work and show recoverable errors (Tasks 1, 4, 5).
4. Keyboard/coarse-pointer/reduced-motion users must retain every normal workflow (Tasks 2, 3, 6).
5. Missing research, empty profiles, failed generations and finalized drafts must never look like successful live data (Tasks 4–6).

## Task 1: Backend draft lifecycle and evidence

**Files:** `backend/app/api/generations.py`, `backend/app/api/editor.py`, `backend/app/schemas/api.py`, `backend/tests/test_draft_lifecycle.py`, matching frontend clients in `frontend/src/lib/api/{generation,history}.ts`.

**Interfaces:** `PATCH /api/generations/{uuid}` accepts `{draft_index:1|2|3, content:string, expected_updated_at:string}` and returns `{generation_id,draft_index,content,updated_at,status}`. `DELETE /api/generations/{uuid}` returns 204. List adds validated `status` and `sort` (`newest`, `oldest`). Full read exposes existing original drafts, research mode/confidence and recorded retrieval time when known. Initial generation response adds `updated_at`.

- [x] Write and run failing tests for save/reload, stale conflict, ownership, finalized/generating locks, invalid content/index, deletion cleanup, status/sort and missing evidence.
- [x] Implement atomic update/ownership, invalidate quality on manual changes, preserve current lifecycle and dependent cleanup.
- [x] Add `saveDraft`, `deleteGeneration`, typed read/write fields and filter params without breaking existing client signatures.
- [x] Run focused backend tests and then full suite; report actual evidence.

## Task 2: Shared design system and shell

**Files:** `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/src/app/layout.tsx`, `frontend/src/components/layout/*`, `frontend/src/components/ui/*` as necessary.

**Interfaces:** retain `AppShell` callback props; add shared `PageHeading`, `ThemeToggle`, and `Brand` components. CSS classes `eyebrow`, `page-title`, `paper`, `field`, `btn-primary`, `btn-secondary`, `icon-button`, `empty-state`, `workspace-enter` provide stable visual primitives.

- [x] Replace broad hover/glow rules with deliberate semantic styling; correctly wire loaded font variables.
- [x] Build desktop navigation and mobile drawer with keyboard/focus support, real search, theme, admin and account links.
- [x] Check label/focus/contrast/viewport behavior in browser, types and lint.

## Task 3: Authentication composition

**Files:** `frontend/src/features/auth/components/auth-screen.tsx`, new local auth composition/CSS files only.

**Interfaces:** preserve `AuthScreen({onOpenLegal})`, existing login/signup/remember/consent hooks and username/password IDs.

- [x] Add browser assertions for auth toggle, validation, failure, session behavior, keyboard and reduced motion before implementation.
- [x] Build original editorial brand stage with pointer-responsive typographic paper composition, clean form and accessible state transitions.
- [x] Verify real callback handling; omit unsupported recovery/verification controls; run focused type/lint evidence.

## Task 4: Dashboard and composer

**Files:** `frontend/src/features/home/components/home-view.tsx`, `frontend/src/features/generation/components/generation-form.tsx`, optional `setup-checklist.tsx`.

**Interfaces:** preserve existing controlled composer props and `HomeView` callbacks, add optional `onGoProfile` for saved setup. Derive counts/cadence from metrics, setup from actual profile and resume reads.

- [x] Write fixture browser checks for quick capture, actual composer payload, loading, retries and empty account.
- [x] Build editorial dashboard with primary composition area, useful recent work and accurately labeled creation cadence.
- [x] Build focused platform-aware composer; every input affects actual request; real elapsed time only, no fabricated stage progression.

## Task 5: Editor, evidence and navigation integration

**Files:** `frontend/src/app/page.tsx`, `frontend/src/features/editor/components/*`, new `frontend/src/features/research/components/research-panel.tsx`, optional focused hooks.

**Interfaces:** use Task 1 clients and timestamps. URL `?view=home|compose|history|profile|selection|editor|privacy|terms&generation=<uuid>&draft=1|2|3` restores through authorized full read; no private text in URL.

- [x] Add failing browser cases for manual save/reload, dirty navigation, conflict/error, account switch, deep link/back, research evidence and finalized locks.
- [x] Implement typed editor text buffer, save/discard/cancel guard, local undo, real AI refinement/finalization, source disclosure and real quality metadata.
- [x] Preserve composer input on failures; prevent duplicate submits and stale async completions; restore URL state and clear account-scoped buffers on logout.
- [x] Run lifecycle browser checks and inspect selection/editor visually in both themes.

## Task 6: Profile, onboarding and history

**Files:** `frontend/src/features/profile/components/profile-page.tsx`, `frontend/src/features/history/components/*`.

**Interfaces:** preserve `ProfilePage({onBack})`, `HistoryList({onBack,onOpen})`; use Task 1 status/sort/delete clients once ready. Persist setup through existing profile/resume APIs; no new schema.

- [x] Add browser checks for save/failure/reload, upload/edit/remove confirmation, export, account deletion, list filters/sort/delete/cancel and empty/error states.
- [x] Redesign profile into clear identity/background/voice/data sections with properly associated labels and loading/error states.
- [x] Redesign history as a readable grouped archive with real result count and pagination; delete only after confirmation and refresh only on success.
- [x] Retain preview modal and existing finalized/read-only behavior.

## Task 7: Remaining pages and final verification

**Files:** `frontend/src/app/admin/page.tsx`, legal views, not-found page, `frontend/tests/*`, `docs/FRONTEND_REDESIGN_VERIFICATION.md`.

- [x] Apply coherent admin/legal/not-found visuals and preserve all admin authorization/data behavior.
- [x] Run ESLint, TypeScript, backend suite and production build without colliding with active dev output.
- [x] Run deterministic browser coverage plus a separate disposable-backend persistence test; inspect desktop/tablet/mobile light/dark and reduced motion.
- [x] Review complete diff independently, fix material findings, record evidence and limitations; commit coherent changes and push `frontend-redesign`.

Execution record: completed on the requested branch. Optional onboarding is delivered as a live-data setup checklist and independently persisted profile sections. Real provider generation, editing and finalization succeeded on disposable data. See `docs/FRONTEND_REDESIGN_VERIFICATION.md` for exact checks and operational limits.
