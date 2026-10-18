# Frontend redesign — implementation and verification

Completed on 2026-10-18 on `frontend-redesign`. Main was not merged or modified.

## Delivered

- Editorial light and warm charcoal dark design systems, shared semantic tokens, correct opacity colors, loaded typography, consistent controls and responsive navigation.
- Interactive authentication composition with scoped GSAP pointer motion, reduced-motion/coarse-pointer handling, a stable accessible form, signup consent, password visibility, remembered sessions and public legal navigation.
- A dashboard backed by actual recent generations and metrics, a seven-day creation chart, quick capture, and an optional setup checklist derived from persisted profile/resume data.
- A focused composer whose controls map to real generation request fields. Busy states show elapsed time instead of invented pipeline progress; errors preserve the author's input.
- Three real draft variations, comparison/copy actions, research evidence, source provenance and safe source links. Unknown publication/retrieval dates and unsupported trend/engagement claims are omitted.
- Direct editing with persisted save, stale-version conflicts, local undo/redo, preview, original-text comparison, per-draft AI conversation and actual finalization. Unsaved edits have save/discard/cancel guards and account-scoped session recovery.
- Durable URL restoration and browser Back/Forward for workspace and public legal screens. Invalid draft selectors normalize safely; account changes clear private recovery buffers and stale responses.
- Searchable, filtered, sorted and paginated history with preview, continuation and real generation deletion. Destructive actions require confirmation.
- Independently persisted identity/background/voice settings; resume upload, extracted-text correction, replacement and confirmed removal; learned style, actual JSON export and typed account deletion.
- Consistent administration, including authorized statistics, costs, user search/paging, draft inspection, audit pagination, errors, keyboard focus and mobile handling. Legal, not-found and error views use the same design language.
- Backend quality evidence explicitly records whether it evaluates a generation or one selected draft. A draft-specific PASS is never presented as evaluating sibling drafts, and legacy unknown scope is not represented as a current passing assessment.

No schema migration was required beyond the earlier audit-remediation migration already preserved in this branch. Added quality metadata lives in existing JSON columns. No new runtime dependencies were introduced.

## Verification evidence

| Check | Result |
| --- | --- |
| Backend pytest suite | **74 passed**, two existing third-party deprecation warnings |
| Frontend ESLint | Passed |
| TypeScript `tsc --noEmit` | Passed |
| Next.js optimized webpack production build | Passed; `/`, `/_not-found`, `/admin` and proxy |
| Production browser smoke suite | All six suites passed: authentication, workspace, draft lifecycle, administration, profile/history and navigation regressions |
| Real backend browser integration | Passed against disposable FastAPI/SQLite: login, profile save/reload, draft save/reload, signup, account isolation, status filtering and deletion |
| Responsive/public-route edge checks | Passed at 390, 768, 1024 and 1440px; maximum-length usernames, legal pages and actual 404 response |
| Live configured AI providers | Generation **HTTP 200**, three drafts, five retrieved sources, `curated_search`; conversational edit **HTTP 200**; finalization **HTTP 200**; learned style read **HTTP 200** with persisted profile |
| Independent code review | Three material findings and missing redo resolved; scoped re-review found no remaining actionable issues |
| Git whitespace checks | Passed |

Deterministic browser tests use clearly identified API fixtures. They do not claim to establish provider availability. The real-backend browser test forwards requests unchanged to a disposable API, without fabricated success responses. Live provider generation/refinement/finalization were verified separately using non-personal test notes and an isolated database. Nothing was published to a social network.

Visual inspection covered authentication, dashboard, composer, selection, editor, profile, history and administration in both themes and representative mobile/desktop layouts, with tablet edge checks. Screenshots are local QA artifacts under ignored `scratch/`; sample content in those screenshots is test data, not production analytics.

## Important regressions caught and fixed

1. Saving while switching variations restored stale client state. Pending navigation now uses the latest saved record.
2. Browser history handling destroyed Forward entries. Native traversal is preserved, including save/discard/cancel on dirty navigation.
3. Fractional draft URL values opened an empty editor. Only indices 1, 2 and 3 are accepted.
4. Historical regeneration reused another post's cached request. Opening stored work clears that cache; its own saved inputs are reviewed before regeneration.
5. Per-draft quality reviews appeared to evaluate every variation. Backend evidence and UI claims are now scoped explicitly.
6. Tailwind opacity modifiers on raw CSS hex variables produced invisible chart bars. Semantic colors now expose RGB channels with alpha support.
7. Closing manually opened search dialogs lost keyboard focus. Search restores focus to its trigger; shared dialogs also preserve opener focus where applicable.

## Reproducing the checks

From `backend`:

```powershell
.venv/Scripts/python.exe -m pytest tests -q --tb=short -p no:cacheprovider
```

From `frontend`:

```powershell
npm run lint
npx tsc --noEmit
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8000'
$env:NEXT_DIST_DIR = '.next-build'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3131
```

In another frontend terminal:

```powershell
$env:BASE_URL = 'http://127.0.0.1:3131'
npm run test:smoke
node tests/responsive-redesign.mjs
```

The browser scripts use installed Chrome on this Windows machine; `BROWSER_PATH` can select another compatible executable.

For the real persistence test, start `backend/tests/serve_browser_e2e.py` from the backend directory, then run `node tests/real-backend.mjs` from the frontend directory. That helper always creates a new database beneath ignored `scratch/browser-e2e`, generates temporary encryption/signing keys, and disables provider credentials by default. Its seeded credentials are test-only. Explicit `--live-ai` enables configured provider keys for a separate live-provider check.

Development can use `NEXT_DIST_DIR=.next-dev`; production builds use `.next-build`. These directories are ignored by Git and ESLint so development and production output do not collide.

## Local use and operational boundaries

The local website is served at `http://127.0.0.1:3000`, with its API at `http://127.0.0.1:8000`. It uses the existing upgraded runtime copy at `scratch/local-runtime/postcraft.db`, preserving the original database. Existing runtime accounts and data remain available. Real provider tests used a separate disposable database.

The product does not imply unsupported password recovery, email verification, recording, social publishing, notifications or a live trends feed. These controls are omitted. Research metadata that was never recorded remains unavailable rather than invented.

Public deployment still requires the real operator's legal/contact details and normal environment/secrets, database backup/migration and hosting configuration described elsewhere in the repository. This local implementation and test record do not certify those operational requirements or guarantee future external provider availability.
