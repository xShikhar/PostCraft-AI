# Premium frontend evolution — 2026-10-18

Branch: `frontend-redesign`. Baseline: `46f58945b72bd950d39de088f6b63c4970ed9d7d`. This pass extends the existing editorial redesign; authentication, API contracts, provider integrations and database models remain unchanged.

## Delivered

- A reusable GSAP/ScrollTrigger scene provides bounded staggered headings, once-only native-scroll reveals, actual chart-bar entrances, subtle fine-pointer card depth and real-state feedback. Fields and the draft writing surface remain spatially steady. Dynamic API content participates without a separate implementation.
- Per-node animation contexts are removed when async content disappears. Navigation, live media preference changes, and unmount dispose observers, listeners, tweens and triggers. Rotation is clamped to 1.5 degrees and resets on scroll, resize, focus, blur and visibility changes. Reduced-motion and touch contexts use static surfaces. Content is visible before motion initializes.
- Login keeps its existing split composition, with coordinated masked typography, SVG line drawing, layered paper, bounded pointer depth and paper-local lighting. Credentials and form geometry stay fixed. Keyboard, consent, session and error behavior remain intact.
- Navigation gains an interpolated current marker, a moving theme thumb, tactile states, search elevation and a matching mobile drawer. Shared theme styles also load on a direct admin visit.
- Profile, archive, draft preview, admin, legal, 404 and error surfaces share the same hierarchy and motion language. Saved feedback appears only after the actual successful save response. Existing reading and editing surfaces remain usable throughout.
- Paper elevations now combine contact shadow, ambient shadow and an inset highlight appropriate to each theme. No extra animation libraries, fake statistics, simulated provider progress or unsupported product controls were introduced.
- Fixed an existing editor scroll issue found by browser testing: opening a draft no longer scrolls the document toward its revision history. Only the chat viewport scrolls when a new message arrives.

## Visual feedback and refinements

Inspected actual Chrome screenshots across light/dark desktop, tablet and mobile. Local evidence is retained under ignored `scratch/premium-auth`, `scratch/premium-navigation`, `scratch/premium-motion`, `scratch/premium-pages` and `scratch/redesign-qa`.

1. Dark login papers merged into their backdrop. Refined the rear paper ink and contact/ambient shadows to separate the layers.
2. Global button hover moved the login submit control. Kept the control steady and moved its internal arrow instead.
3. The active navigation edge and dark theme thumb lacked separation. Increased their quiet borders/contact shadows and matched the mobile drawer surface to the sidebar.
4. Drawer primitives overrode the intended animation. Added explicit state selectors and independent CSS translation, preserving the reduced-motion alternative.
5. The old whole-page entrance displaced the editor while typing. Disabled that duplicate entrance inside scenes, then fixed the independent initial chat scrolling issue exposed by the same test.
6. A shared display rule stacked the Saved icon above its label. Removed the rule so the component retains its inline-flex layout.
7. Legal content uses paragraph lead-ins rather than section headings. Added restrained reveals to the actual authored paragraphs without changing policy wording.
8. Review caught async node retention and stale pointer bounds. Added removal pruning and bounded/reset pointer behavior, then reran integration checks.

## Verification

- Frontend ESLint: passed.
- TypeScript `tsc --noEmit`: passed.
- Optimized Next.js production build: passed.
- Backend: **74 passed**, with the two existing Starlette/Argon2 deprecation warnings.
- Six existing production browser suites: passed (auth, workspace, draft lifecycle, admin, profile/history, navigation regressions).
- Four new motion suites: passed — authentication, navigation, shared scene and remaining pages, covering normal/reduced motion, touch, runtime preference change, steady inputs, pointer depth, route cleanup and mobile alternatives.
- Responsive checks: passed at 390, 768, 1024 and 1440 pixels, including public legal routes, maximum-length username and real 404 response.
- Real API/database browser integration: passed login, signup, profile save/reload, draft save/reload, account isolation, status filtering and deletion against isolated FastAPI/SQLite.
- Fresh direct `/admin` visit: passed theme-thumb dimensions and actual theme switching; inspected the resulting dark screenshot.
- Independent code review: resolved its shared admin theme-styles finding. No additional correctness/security findings. Earlier cleanup and pointer-bound findings were also fixed and reverified.

The browser UI suites use explicit deterministic API fixtures; they are not evidence of live provider responses. `real-backend.mjs` separately uses real FastAPI requests and a disposable SQLite database to check persistence. Live paid provider calls were not repeated for this visual-only pass; the prior redesign verification documents those checks.

The new mobile archive test initially sampled stale desktop geometry immediately after a browser viewport resize: a pagination group reached 528.5px in the new 390px viewport. Repeated bounds measurements showed that the responsive layout fit within 100ms and stayed within bounds. The test now waits up to five seconds for that same no-overflow condition, then retains the original assertion. No product layout change was needed.

Production commands ran from `frontend` with `BASE_URL=http://127.0.0.1:3000`: `npm run test:smoke`, `npm run test:motion`, `node tests/responsive-redesign.mjs`, and `node tests/real-backend.mjs`. Backend regression command: `.venv/Scripts/python.exe -m pytest tests -q --tb=short -p no:cacheprovider`.

## Local use

Production frontend: `http://127.0.0.1:3000`. Local API: `http://127.0.0.1:8000`. The API continues to use the existing local runtime database copy under `scratch/local-runtime`; the integration test database is separate. Local servers require their processes to remain running.
