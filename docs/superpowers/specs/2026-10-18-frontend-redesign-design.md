# PostCraft AI frontend redesign: audited design proposal

Date: 2026-10-18
Branch: `frontend-redesign`
Status: approved by the user and implemented on `frontend-redesign`; see `docs/FRONTEND_REDESIGN_VERIFICATION.md` for evidence.

## Intent and constraints

Deliver the complete redesign requested in the attached brief: an editorial writing product with an exceptional authentication experience, coherent light and dark themes, and functional workflows through setup, generation, research, refinement, saved drafts, history, profile, legal, and administration. Every shipped control must have real behavior. Preserve authentication, ownership checks, encryption, consent, existing generation and research integrations, and persisted data.

The earlier audit fixes are necessary baseline work and remain on this branch as a separate commit. Main must remain unchanged. Runtime databases, uploaded files, secrets, local backups, and generated test artifacts must not be committed. Existing local servers currently use a separate upgraded SQLite copy under `scratch/local-runtime`; that development data is not a deployment database.

Assumptions: LinkedIn and X remain the supported platforms; the application does not publish directly to those platforms; the existing logo is retained; research is associated with generated posts rather than a new live trends service; optional setup should not prevent users from drafting.

## Repository audit

The frontend is Next.js App Router with React, TypeScript, Tailwind, Radix primitives, next-themes, Sonner, GSAP, and @gsap/react. Contrary to the brief's provisional stack list, TanStack Query, Zustand, and Motion are not installed. Keep the established API client and React state patterns; adding three new state/motion libraries is unnecessary.

There are two actual route pages: `/` and `/admin`. The root dispatches authentication, home, compose, selection, editor, history, profile, privacy, and terms through React state. Legal content is also accessible without authentication. This preserves distinct screens but does not currently give workspace screens durable URLs or restore the active draft on refresh.

Backend capabilities are implemented in `backend/app/api/{auth,generations,editor,users,admin,health}.py`; persistence uses SQLAlchemy and Alembic. Development currently uses SQLite, while deployment supports PostgreSQL. User profile/background/style text is encrypted. Generation stores original drafts, context, research evidence, quality evidence, and conversation messages.

Central frontend clients already cover authentication, generation/edit/finalize, generation history/metrics, user updates, resume upload/edit/remove, style profiles, account erasure, and admin reads. The shared client handles tokens, account switching, timeouts, rate limits, and JSON/multipart bodies. Preserve those protections.

### Existing workflows and gaps

| Surface | Current real capability | Redesign work and necessary integration |
| --- | --- | --- |
| Authentication | Username/password signup and login, consent, password visibility, remembered sessions, logout, public legal content | Split editorial composition and focused form; accessible transitions and errors; do not imply email delivery or verification |
| Home | Personalized greeting, quick capture, recent persisted drafts, server totals and seven-day creation dates | Stronger hierarchy, useful setup checklist, real activity distribution, resilient loading/error/empty states |
| Compose | Platform, topic, raw thoughts, context override, use-saved-context toggle, real generation POST | One primary writing surface with secondary controls; preserve all limits; real elapsed time rather than invented stage percentages |
| Selection | Three actual outputs, copy, choose draft, source links | Consistent comparison layout; counts computed from content; quality and research disclosures from response data; refine inputs/regenerate reuse actual request inputs |
| Research | Sources/confidence/provider in generation response; stored research JSON; full-generation API currently exposes only sources and quality | Evidence panel with snippets, safe source URLs and provenance; extend response typing and read endpoint to expose existing metadata, including retrieval time only if known |
| Editor | AI refinement POST, conversation per draft, finalization, copy and draft switching | Add direct text editing and explicit persisted save; dirty-state protection; local undo/redo for unsaved edits; preserve AI and finalization behavior |
| History and drafts | Authorized search/filter/pagination; full persisted drafts/chat retrieval | Add status filter and validated sort; real delete with confirmation; no fabricated archive totals or result counts |
| Setup | Existing persisted about-me, background, writing-style and resume settings | Optional guided setup using those existing APIs; dashboard completion derives from actual saved fields; no completion state invented from a toast |
| Profile/settings | Three editable text fields, uploaded/extracted resume editing, learned style dimensions, export, account deletion | Clear sections, precise labels, associated form labels, retry states, confirmation before resume removal, consistent danger area |
| Admin | Role-gated statistics, paginated user inspection, costs and audit events | Apply the shared system while preserving authorization, pagination, audit semantics and actual returned metrics |
| Legal/not found | Real legal content and framework not-found page | Shared readable typography and navigation; do not invent operator contact details or operational guarantees |

### Reference inventory

Reviewed both `design-reference/light/luminous_editorial_ai/DESIGN.md` and `design-reference/dark/warm_editorial_charcoal/DESIGN.md`, every exported HTML document, the fourteen corresponding screenshots, and the two logo assets. Folder name in this checkout is `design-reference`.

| Screen pair | Light reference folder | Dark reference folder | Adopt | Adapt or omit |
| --- | --- | --- | --- | --- |
| Authentication | `postcraft_ai_sign_in_light_mode` | `postcraft_ai_sign_in_functional_dark_mode` | Compact readable form, brand mark, consent/session controls | Expand into an original interactive editorial composition; omit unsupported forgot-password, external status and verification links |
| Dashboard | `postcraft_ai_home_light_mode` | `postcraft_ai_home_functional_dark_mode` | Greeting, quick capture, recent work, weekly cadence | Compute creation cadence from API timestamps; omit fake growth percentages, voice percentages, recording and notifications |
| Compose | `postcraft_ai_new_generation_light_mode` | `postcraft_ai_new_generation_functional_dark_mode` | Large thought surface, platform selector, saved-context control | Keep current request fields; omit decorative tone chips unless they map explicitly into supplied author instructions; stage rail explains workflow without pretending to receive live stage events |
| Selection | `postcraft_ai_draft_selection_light_mode` | `postcraft_ai_draft_selection_functional_dark_mode` | Three readable drafts, copy and refine actions | Label actual output variants without asserting their rhetorical category; omit fabricated per-draft rankings, recommended winner and style-match score |
| Editor | `postcraft_ai_draft_editor_light_mode` | `postcraft_ai_draft_editor_functional_dark_mode` | Writing surface beside conversation; real instruction shortcuts | Implement actual manual save; show saved/unsaved honestly; finalization is not publishing |
| History | `postcraft_ai_history_light_mode` | `postcraft_ai_history_functional_dark_mode` | Grouped editorial list, platform filters and continuation actions | Use actual pagination, statuses and totals; no hardcoded page count or example history |
| Profile | `postcraft_ai_profile_voice_light_mode` | `postcraft_ai_profile_voice_functional_dark_mode` | Profile/background/style sections and learned dimensions | Preserve separate saved fields; omit unsupported full-history reanalysis; style learning remains tied to real finalization |

## Design direction and alternatives

Recommended: evolve the references into one editorial identity, keeping the existing architecture and GSAP. Light mode uses a pale lavender canvas, white paper, ink typography and restrained violet accents. Dark mode uses warm charcoal, warm white text and coral accents. Layout, typography hierarchy, spacing and component anatomy remain the same between themes.

Alternative 1: reproduce the exported screens closely. This is faster visually but preserves their cramped typography, decorative controls, inconsistent light/dark interaction details, and fabricated example metrics. Reject direct copying.

Alternative 2: replace the frontend with a new router/state/motion stack. This allows a clean implementation but increases migration risk, dependencies and review scope without improving the existing backend integration. Reject a rewrite.

### Tokens and reusable components

- Keep semantic CSS variables and Tailwind mappings, consolidating overlapping aliases as each surface is touched. Specify canvas, paper, inset, text, muted text, border, accent, accent contrast, success, warning, danger, focus, elevation and motion roles for each theme.
- Retain the Lato/Merriweather pairing for continuity, but make font-family tokens use the actual loaded font variables. Use a small set of weights and self-host supplied font assets if available; otherwise retain Next's font optimization with documented network requirements and good fallbacks.
- Use an 8px spacing rhythm, 4px detail increments, 12–16px panel radii, and 44px minimum targets for important touch interactions. Maintain legible 14–16px interface text and a restrained 32–48px editorial heading scale.
- Standardize page header, section heading, field/description/error, skeleton, empty state, retry state, platform badge, status badge, confirmation dialog, theme control and source item. Reuse the existing Radix dialog focus behavior.
- Desktop: a quiet sidebar and useful header, bounded reading widths, editor/chat split. Tablet: collapsible drawer and stacking panels. Mobile: compact header, accessible navigation drawer, single-column forms and drafts, no permanent rail consuming writing width.

### Authentication and motion

Desktop authentication pairs an editorial brand stage with a stable form. The stage uses code-native typographic sheets and the existing mark: layered paper, a restrained orbit/guide line and deliberate spacing. It is illustrative brand composition, not fake product output or activity.

Use GSAP/useGSAP with scoped refs, cleanup and matchMedia. Pointer movement is limited to the composition, interpolated to small transform/rotation ranges and disabled for coarse pointers and reduced motion. Form fields must never move while typing. Entrance choreography lasts approximately 600–800ms overall; mode changes use short opacity/position transitions without changing focus unexpectedly. Ordinary app feedback uses 120–220ms and view entry about 240ms. No endless GPU-intensive animations, blur fields or scroll-blocking effects.

Signup keeps required consent and current password rules. Login preserves existing remember-session behavior. Invalid credentials remain a real server error; success transition happens only after a real successful response. Recovery and verification UI are omitted because no delivery/token lifecycle exists.

### Navigation and persistence

Retain the root workspace dispatcher, extract its orchestration into focused hooks, and use validated URL query state for view, generation ID and selected draft. Link and browser-back navigation must restore a generation through the authorized full-generation endpoint. Do not place draft text, background/resume content or tokens in URLs.

Generated work remains in the database. Protect dirty manual edits on in-app navigation, switching drafts, AI refinement and finalization; offer save/discard/cancel. Register beforeunload only while dirty. Unsaved input recovery can use sessionStorage scoped to authenticated user ID, with explicit clearing on sign-out/account deletion; no private editor content in unscoped localStorage. A successful save is acknowledged only after the server confirms it. On 401 clear authenticated state; on account switch discard stale responses as the shared client already does.

### Generation and research

Every composer control maps to an existing request field. Default platform and use-context behavior remain unchanged. If optional tone/audience hints are added, show the exact author instruction they contribute; do not add inert preference controls. Prefer saved writing-style settings and raw author input over expanding the model schema unnecessarily.

The current generation API is request/response, not SSE. Show an indeterminate busy state, elapsed time and a static explanation of research/style/drafting/checking. Do not animate fabricated stages, percent completion, live sources or token counts. Preserve input on provider/network/rate-limit failure and offer a deliberate retry rather than silent duplicate AI requests.

Research accompanies draft selection and editing. Show source title, snippet, domain, actual confidence/source mode and the generation's recorded research retrieval time if available. Distinguish generated structural guidance from retrieved sources. Missing publication dates stay absent. Cache origin or age is displayed only if backed by stored metadata; generation creation time must not be mislabeled as a source publication time. Only http/https links are clickable, with safe external-link attributes. Omit live trends and engagement analytics because no authoritative feed exists.

### Direct editing, quality and deletion

Add an ownership-checked manual-save endpoint under `/api/generations/{id}` with a validated draft index, bounded nonempty content and expected update timestamp. It must reject finalized/generating records and stale edits, persist exactly the supplied content, return the new version, and avoid calling the LLM. Changing the text invalidates prior quality evidence and requires fresh review; old quality scores must not be presented as evaluating the new text. Existing finalization performs its real checks and continues to learn preferences through the existing pipeline.

Local undo/redo covers edits in the current editor session. Original generated drafts can be compared using already stored data, if exposed through the read response. Do not claim a durable revision timeline without a persisted revision model.

Add ownership-checked deletion for a generation with a confirmation dialog naming the topic. Remove dependent chat/cost rows consistently and refresh metrics/history only after success. Deleting a generation must not silently claim to reset learned account-wide style preferences; account erasure remains the separate operation that removes those. If deletion is unsafe during a generating/finalizing operation, reject it with a clear retryable response.

Extend list query validation with status and an allowlisted sort order. Apply filtering/sorting before pagination and count using the same scope. Never expose another user's generation through saves, deletes, filters or full reads. Existing tables suffice for these additions; avoid a new schema unless implementation uncovers a concrete need.

## Implementation sequence and review boundaries

1. Preserve the audited baseline and publish this branch. Review the written design before product changes.
2. Establish tokens, reusable primitives, responsive shell, accessibility and motion conventions.
3. Implement authentication and optional setup, keeping real auth/profile APIs.
4. Redesign dashboard and composer using existing metrics/history/generation data.
5. Implement manual draft persistence and history mutations with focused backend tests, then connect selection/editor/research/history and URL restoration.
6. Complete profile, admin, legal and not-found consistency; remove unsupported decorative controls.
7. Run browser visual and functional QA, frontend lint/type/build, backend tests and focused integration scenarios. Commit coherent slices and push the branch without merging main.

Before coding, convert the approved design into an actionable implementation plan, including file boundaries, test cases and execution method. Keep earlier remediation in its own commit so reviewers can distinguish prerequisite security/functionality fixes from redesign changes.

## Verification and acceptance

Baseline verification on 2026-10-18: backend tests 56 passed with two third-party deprecation warnings; frontend ESLint and TypeScript (`tsc --noEmit`) passed. `git diff --check` passed. Earlier browser tests use fixtures and do not prove live AI provider availability. A production build and a new browser acceptance run remain required after implementation.

For implementation acceptance:

- Run backend tests against disposable storage with providers mocked only where appropriate for deterministic tests. Add authorization, malformed input, stale version, finalized lock, dependent cleanup, filtering and save/reload cases for new endpoints.
- Run frontend lint, TypeScript and production build. Do not run a production build in the active dev server's output directory concurrently; use separate output or stop/restart deliberately.
- Extend browser fixtures for all controls, errors, empty states, dirty-state navigation, deletion, onboarding, session handling, keyboard use, URL restoration and responsive behavior. Label fixture evidence honestly.
- Run a separate browser integration against a disposable real backend database for signup, login, persisted profile changes, save/reload, filtering/deletion and account isolation. No mocked success notifications.
- Inspect every screen in light/dark at representative desktop, tablet and mobile widths, with focus on readable writing widths, no horizontal overflow, dialog scrolling, contrast, missing labels, focus restoration and reduced motion.
- Live AI generation must use the real configured providers and must be reported separately from fixture tests; do not fabricate sources or provider success if credentials/quota/network prevent verification.
- Deliver exact check results, screenshots and remaining operational limitations. A rendered screen alone is not proof of completion or production readiness.

## Explicit exclusions from the current design

No direct social publishing, scheduled posts, team collaboration, new billing, email password reset, email verification, live trending-feed service, notification inbox, audio recording, invented engagement forecasts or fabricated style scores. These require independent product/security/integration work and are not necessary to meet the supplied brief's rule to omit unsupported functionality.
