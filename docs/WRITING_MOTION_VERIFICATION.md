# Writing interaction polish — 2026-10-19

Branch: frontend-redesign. Extends the existing editorial motion design without changing provider behavior.

- Rotating scratchpad prompts use masked, dimensional text transitions. They remain outside the textarea, stop on focus or entered text, honor global/OS motion preferences and pause when the document is hidden. Screen readers receive one stable description.
- Recent draft and history cards transition into the editor using native View Transitions after a successful fetch. Loading retains the source card with an accessible floating status and inert content. Unsupported browsers and reduced/paused motion navigate normally. Failed loads clear transition state; pause changes finish an active transition.
- Manual and keyboard saves trigger an ink-line and paper-light flourish only when the existing save function returns success. Initial render, errors and conflicts do not celebrate. The existing dirty-state and error messages remain authoritative.

Verification: production build, ESLint, TypeScript, writing-motion browser suite (including actual native transition readiness), workspace workflow suite, editor lifecycle/save-conflict suite, navigation regressions, responsive checks at 390/768/1024/1440px and real FastAPI/SQLite persistence checks passed. The lifecycle test now waits for login completion before navigating to its deep link.

Inspected Chrome screenshots of the rotating prompt, in-flight card transition and confirmed save. Browser fixture checks cover failure and fallback behavior; real-backend integration separately verifies login, profile and draft save/reload, account isolation, filtering and deletion. No paid provider calls were made. Screenshots remain under ignored scratch/writing-motion/.
