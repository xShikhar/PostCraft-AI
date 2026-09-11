# PostCraft AI — Polish Changelog

This changelog records all motion and interaction polish adjustments applied using the official GSAP skills (`gsap`, `@gsap/react`). Every change is documented with the problem addressed, files modified, the exact transition changes, and individual revert instructions.

---

## Motion Principles
- **Productivity Ergonomics**: Fast, purposeful, subtle (150–250ms). Never blocks user actions or creates unnecessary delays.
- **Accessibility**: Full compliance with `prefers-reduced-motion` using GSAP / media query detection.
- **Leak-Free Scoping**: All React animations use `@gsap/react`'s `useGSAP()` hook with scoped refs and clean teardown.
- **No Layout Thrashing**: Animations prioritize GPU-friendly transforms (`x`, `y`, `scale`, `opacity`, `autoAlpha`).

---

## Log Entries

### [2026-09-10] Item 1 — Draft Card & Recent Card Hover-Expand & Dimming
- **Problem**: Draft cards and recent cards relied on static CSS transitions and `:has()` selectors which lacked velocity-aware interpolation, causing stutter on rapid cursor transitions between cards, and did not cleanly support `prefers-reduced-motion` scaling suppression.
- **Files Modified**:
  - `frontend/src/features/editor/components/draft-selection-grid.tsx`
  - `frontend/src/features/home/components/home-view.tsx`
  - `frontend/src/app/globals.css`
- **What Changed**:
  - Replaced CSS `:has()` and pseudo-class transitions with GSAP `useGSAP()` and `contextSafe` event handlers.
  - Hovered card scales smoothly (`scale: 1.025` on Draft Grid, `scale: 1.02` on Home Recent cards) over 220ms with `power2.out`.
  - Non-hovered sibling cards gently dim to `opacity: 0.55` and `filter: saturate(0.7)` over 220ms with `power2.out`.
  - On mouse leave from grid container, cards restore to `scale: 1.0`, `opacity: 1.0`, and full saturation over 250ms with `overwrite: "auto"`.
  - Full `prefers-reduced-motion` compliance: scaling is omitted (`scale: 1.0`) when reduced motion is preferred by the user's system.
  - Excluded GSAP-managed cards from CSS `.btn-press:hover` and `.history-card:hover` translateY transitions to eliminate CSS/GSAP style collisions.
- **Verification**: Verified via Playwright CLI test (`verify_item1.mjs`) in Light Mode (`matrix(1.025, ...)`), Dark Mode, and Prefers-Reduced-Motion (`matrix(1, ...)`). Both screenshots captured.
- **Revert Instructions**:
  - In `draft-selection-grid.tsx`: Remove `useGSAP`, `gridRef`, `handleCardMouseEnter`, `handleGridMouseLeave` and restore CSS classes.
  - In `home-view.tsx`: Remove `recentGridRef`, `useGSAP` hover handlers and restore `transition-all`.
  - In `globals.css`: Re-add the `.draft-grid:has(...)` block and remove card exceptions in `.history-card:hover` and `.btn-press`.

### [2026-09-10] Item 2 — Sidebar Collapse/Expand Easing
- **Problem**: Sidebar collapse used CSS `transition-all duration-300` on width (`w-sidebar-width` to `w-0 overflow-hidden`), which caused inner text to wrap, squash, and reflow as width narrowed before disappearing, while the collapsed rail abruptly popped in without entry/exit easing.
- **Files Modified**:
  - `frontend/src/components/layout/sidebar.tsx`
  - `frontend/src/components/layout/app-shell.tsx`
  - `frontend/src/components/layout/top-header.tsx`
- **What Changed**:
  - Main Sidebar: Replaced width collapse with hardware-accelerated GSAP `xPercent: -100` and `autoAlpha: 0` easing (`power2.inOut`, 240ms) with `w-sidebar-width` preserved, completely eliminating text squashing.
  - Collapsed Rail: Retained in DOM and animated via GSAP from `x: -64` to `x: 0` (`autoAlpha: 1`, `power2.out`, 240ms) on collapse, and smoothly exited to `-64` (`autoAlpha: 0`, 200ms) on expand.
  - Main Content & Header: Synchronized padding-left and header left position transitions to 240ms `ease-out`, matching GSAP's timeline seamlessly.
  - Reduced Motion: Immediate state transition (`duration: 0`) under `prefers-reduced-motion: reduce`.
- **Verification**: Verified via Playwright CLI test (`verify_item2.mjs`) in Light Mode, Dark Mode, and Prefers-Reduced-Motion. All states tested (expanded -> collapsed -> restored). Screenshots captured for both modes.
- **Revert Instructions**:
  - In `sidebar.tsx`: Revert `aside` styling back to `${collapsed ? "w-0 overflow-hidden p-0" : "w-sidebar-width"}` and remove `useGSAP` slide hook.
  - In `app-shell.tsx`: Restore `{collapsed && <aside` conditional mount for the rail and remove `railRef` hook.
  - In `top-header.tsx`: Restore `transition-all duration-300 ease-in-out`.

### [2026-09-10] Item 3 — Light/Dark Theme Toggle Motion & Surface Blending
- **Problem**: The theme toggle switch abruptly swapped solid background colors between Light and Dark buttons with no sliding indicator or tactile feedback, while page-level color switches snapped instantly without interpolation.
- **Files Modified**:
  - `frontend/src/components/layout/sidebar.tsx`
  - `frontend/src/app/globals.css`
- **What Changed**:
  - Switch Component: Added a physical sliding pill thumb (`pillThumbRef`) animated with GSAP `xPercent: 100` / `0` over 220ms (`power2.out`) behind transparent active button labels.
  - Micro-Interactions: Added GSAP `back.out(1.7)` rotational cues on the icons (`rotation: 30` -> `0` for Sun, `rotation: -25` -> `0` for Moon).
  - Page Surfaces: Added gentle 200ms `transition: background-color 0.2s ease, border-color 0.2s ease` to `body`, `aside`, `header`, and `main` in `globals.css` to prevent harsh visual flashes during theme swaps.
  - Accessibility: Under `prefers-reduced-motion: reduce`, sliding duration is 0 and icon rotation is omitted.
- **Verification**: Verified via Playwright CLI test (`verify_item3.mjs`) in Light Mode (`matrix(1, 0, 0, 1, 0, 0)`), Dark Mode (`matrix(1, 0, 0, 1, 112.5, 0)`), and Prefers-Reduced-Motion. Screenshots captured for both modes.
- **Revert Instructions**:
  - In `sidebar.tsx`: Remove `pillContainerRef`, `pillThumbRef`, `sunIconRef`, `moonIconRef` and the theme toggle `useGSAP` hook; restore static button classes.
  - In `globals.css`: Remove the background-color and border-color transitions on `body, aside, header, main`.

### [2026-09-10] Item 4 — Subtle List Entrance Stagger (History & Drafts)
- **Problem**: History list and draft cards used CSS keyframes (`.animate-fade-slide-up`) with `animation-fill-mode: both` and fixed animation delays. This locked elements into permanent CSS animation states that clashed with hover transitions and could not automatically clear props upon completion.
- **Files Modified**:
  - `frontend/src/features/history/components/history-list.tsx`
  - `frontend/src/features/editor/components/draft-selection-grid.tsx`
  - `frontend/src/features/home/components/home-view.tsx`
- **What Changed**:
  - Replaced CSS keyframe animations with GSAP `gsap.from()` using `@gsap/react`'s `useGSAP()` hook.
  - Fast, purposeful timing: 220ms duration with a tight 40ms stagger (`ease: "power2.out"`).
  - Explicit teardown: `clearProps: "all"` ensures inline styles and entrance transforms are completely removed upon completion, leaving elements in a pristine state for hover interactions.
  - Accessibility: Respects `prefers-reduced-motion` by skipping entrance offsets and setting immediate full opacity.
- **Verification**: Verified via Playwright CLI test (`verify_item4.mjs`) in Light Mode, Dark Mode, and Prefers-Reduced-Motion. Verified `clearProps: "all"` results in `transform: none` post-animation. Screenshots captured for both modes.
### [2026-09-10] Item 5 — Generation Pipeline Loading Steps Motion
- **Problem**: Sequential loading steps ("Researching topic...", "Analyzing tone...", etc.) in the Studio Workspace had instant text cuts, an abruptly appearing container card, and relied on a static CSS transition on `transform` for the progress bar that could fight programmatic timing and lack smooth state-to-state feedback.
- **Files Modified**:
  - `frontend/src/features/generation/components/generation-form.tsx`
  - `frontend/src/app/globals.css`
- **What Changed**:
  - Container Entrance: Added a subtle fade/slide entrance (`opacity: 0, y: -8` -> `1, 0` over 240ms, `power2.out`) when `loading` begins.
  - Progress Bar Tweening: Progress bar uses GSAP `gsap.to()` on `scaleX` (from `(activeStep + 1) / 4`) over 350ms with `power2.out`. Removed CSS `transition: transform` from `.pipeline-fill` in `globals.css` to eliminate interpolation fights.
  - Step Text Cross-Fade: Subtitle step description smoothly fades and rises (`opacity: 0, y: 3` -> `1, 0` over 200ms, `power2.out`) on each sequential step advance.
  - Active Step Pulse: The newly active step label receives a micro-pulse (`scale: 1.12` -> `1.0` over 220ms with `back.out(2)`) to provide tactile progress cues.
  - Accessibility: Immediate state assignments (`duration: 0`) under `prefers-reduced-motion: reduce`.
- **Verification**: Verified via Playwright CLI test (`verify_item5.mjs`) across Light Mode, Dark Mode, and Prefers-Reduced-Motion. Verified initial `scaleX` at step 0 (`matrix(0.25, 0, 0, 1, 0, 0)`), smooth advance to step 1 (`matrix(0.5, 0, 0, 1, 0, 0)`), and highlighted step counts. Screenshots saved for both themes.
- **Revert Instructions**:
  - In `generation-form.tsx`: Remove `trackerRef`, `progressBarRef`, `stepTextRef`, `labelsContainerRef`, and the two `useGSAP` loading hooks; restore simple inline styling.
  - In `globals.css`: Re-add `transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1),` to `.pipeline-fill`.

### [2026-09-10] Item 6 — Chat Message Appearance Motion (Draft Editor)
- **Problem**: In the Draft Editor chat stream, new message bubbles (both user edit prompt submissions and assistant response confirmations) popped into the DOM abruptly with zero motion feedback, creating a disjointed feel during conversational draft iteration.
- **Files Modified**:
  - `frontend/src/features/editor/components/draft-editor.tsx`
- **What Changed**:
  - Scoped Message Entrance: Added a `useGSAP()` hook scoped to `chatListRef` monitoring `chatHistory.length`.
  - Directional Feedback: Newly appended message bubbles subtly slide and fade into view:
    - User messages (align-right): slide gently from `x: 8`, `y: 8`, `scale: 0.98` to `(0, 0, 1.0)` over 200ms (`power2.out`).
    - Assistant messages (align-left): slide gently from `x: -8`, `y: 8`, `scale: 0.98` to `(0, 0, 1.0)` over 200ms (`power2.out`).
  - Props Cleared: `clearProps: "transform"` ensures bubbles revert to clean layout positioning without leftover inline style matrix locks.
  - Existing History Preserved: Only newly arrived messages trigger the tween; historical messages on draft opening render statically without flashing.
  - Accessibility: Under `prefers-reduced-motion: reduce`, the tween is skipped and the message renders instantly.
- **Verification**: Verified via Playwright CLI test (`verify_item6.mjs`) across Light Mode, Dark Mode, and Prefers-Reduced-Motion. Verified quick-chip click, send action, user message slide-in, assistant response, and settled transform (`transform: none`). Screenshots saved for both themes.
- **Revert Instructions**:
  - In `draft-editor.tsx`: Remove `chatListRef`, `prevCountRef`, the message entrance `useGSAP` hook, and the `chat-bubble` class name from message items.

### [2026-09-10] Item 7 — Form Focus States & Surface Elevation
- **Problem**: Form inputs and textareas (Studio Workspace topic, profile context, raw thoughts, and Persona Engine profile fields) had abrupt, 0ms snap focus ring appearances without interpolated transitions or tactile elevation feedback, making active input focus feel rigid and unpolished.
- **Files Modified**:
  - `frontend/src/app/globals.css`
  - `frontend/src/components/ui/input.tsx`
  - `frontend/src/components/ui/textarea.tsx`
  - `frontend/src/features/generation/components/generation-form.tsx`
  - `frontend/src/features/profile/components/profile-page.tsx`
- **What Changed**:
  - CSS Focus Smoothing: Added `.input-focus-smooth` in `globals.css` with a smooth 200ms `cubic-bezier(0.16, 1, 0.3, 1)` transition for `border-color`, `box-shadow`, and `background-color`, and added it to base `Input` and `Textarea` primitives.
  - GSAP Micro-Elevation: Attached scoped `useGSAP()` event listeners on `focusin`/`focusout` in both `GenerationForm` and `ProfilePage`.
    - On focus: Input or textarea smoothly elevates (`scale: 1.006` over 180ms with `power2.out`), creating a subtle, tactile sense of the active writing surface without causing any layout shift or text fuzziness.
    - On blur: Smoothly returns to `scale: 1.0` over 180ms with `power2.out`, and calls `clearProps: "transform"` to restore pristine styling.
  - Accessibility: In `prefers-reduced-motion: reduce`, scaling is omitted and CSS transitions are reduced to 0.01ms.
- **Verification**: Verified via Playwright CLI test (`verify_item7.mjs`) across Light Mode, Dark Mode, and Prefers-Reduced-Motion. Verified `#topic` focus (`matrix(1.006, 0, 0, 1.006, 0, 0)`) & blur (`none`), `#rawThoughts` focus & blur, and Profile page textarea focus & blur. Screenshots saved for both themes.
- **Revert Instructions**:
  - In `globals.css`: Remove the `.input-focus-smooth` rule.
  - In `input.tsx` and `textarea.tsx`: Remove `input-focus-smooth` from className.
  - In `generation-form.tsx`: Remove `formContainerRef` and the focus elevation `useGSAP` hook.
### [2026-09-10] Performance Polish — Zero-Jank 60FPS Optimization & Non-Blocking Async
- **Problem**: User reported website lagging. Analysis identified two primary root causes:
  1. Frontend: Rapid cursor movements over cards triggered `getBoundingClientRect()` on every `onMouseMove` event (60–144Hz) for spotlight radial gradients, forcing synchronous reflow/layout thrashing during GSAP scaling. Sibling card dimming also animated `filter: saturate(...)`, causing heavy software rasterization on each animation frame. Additionally, continuous 20s infinite transform loops on large blurred background elements (`.ambient-orb`) consumed ongoing GPU composite bandwidth.
  2. Backend: ChromaDB vector profile storage synchronously invoked an 80MB ONNX embedding model download on uvicorn's main async thread during the pipeline's pattern extraction stage, freezing the entire FastAPI server and causing subsequent frontend API calls (e.g., `/api/health`, `/api/users/me`) to hang and time out through Caddy.
- **Files Modified**:
  - `frontend/src/features/home/components/home-view.tsx`
  - `frontend/src/features/editor/components/draft-selection-grid.tsx`
  - `frontend/src/app/globals.css`
  - `backend/app/services/vector.py`
  - `backend/app/services/pipeline/nodes.py`
- **What Changed**:
  - Removed `onMouseMove` and `getBoundingClientRect()` from `.recent-card` in `home-view.tsx` and `.draft-card` in `draft-selection-grid.tsx`.
  - Converted `.spotlight-card` into a pure CSS ambient hover radial gradient, completely eliminating JavaScript mouse event listeners and layout recalculations.
  - Replaced CPU-intensive `filter: "saturate(...)"` tweens in `draft-selection-grid.tsx` with pure GPU-composited `scale` and `opacity` transitions.
  - Updated entrance tween cleanup to `clearProps: "all"` across cards to prevent lingering inline transform properties.
  - Stabilized `.ambient-orb` in `globals.css` as static GPU-composited ambient gradients without continuous transform animation loops.
  - Added `HttpClient` support to `VectorService` in `vector.py` when `CHROMA_HOST` is configured.
  - Wrapped all ChromaDB calls in `nodes.py` (`_build_temporal_style_bias`, `save_style_profile`, `delete_oldest_profiles`) inside `asyncio.wait_for(asyncio.to_thread(...), timeout=...)` with non-blocking error fallbacks so auxiliary vector operations can never block the FastAPI event loop.
- **Verification**: Verified via Playwright test suite (`verify_item1.mjs` through `verify_item7.mjs`), cURL API health check (`200 OK` in 140ms), and production container build.
