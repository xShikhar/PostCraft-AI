# Catch a Thought — generation intermission

The generation wait screen replaces the disabled form and plain status strip with an editorial intermission. Form values remain owned by the workspace hook and return unchanged on request failure.

The pipeline illustration has three interactive chapters: Discover, Compose and Consider. Selecting a chapter explains its purpose. It explicitly describes itself as an illustration because the existing synchronous API does not expose live stage events. The timer reflects actual elapsed request time; no progress percentage or completion estimate is invented.

Optional paper-flight play uses click, touch or Space/Enter to lift a paper plane, collect punctuation and avoid ink strokes. Scores, a session best, immediate restarts, pause/resume and collected-word highlights are local UI state. No game input is sent to the generation service. The animation loop is canceled on unmount and paused when the tab is hidden. Reduced-motion and the global pause setting replace flight with a motion-free word collection interaction.

The existing generation response immediately opens draft selection; the game never delays it. Errors immediately restore the original form and its inputs.

## Verification

- Production build and TypeScript validation passed.
- ESLint passed with the pre-existing unused variable warning in `real-finalize-review.mjs`.
- Browser fixture test: `tests/generation-intermission.mjs` covers keyboard play, actual point collection, collision/restart, pause/resume, interactive pipeline chapters, reduced-motion mode, mobile overflow, immediate completion and failure/input recovery.
- Existing `tests/workspace-redesign.mjs` covers the preserved workspace workflow.
- Desktop and mobile browser screenshots inspected. Use viewport screenshots for this page: full-page capture in the installed Chrome altered fixed-element rendering despite correct live layout measurements.
