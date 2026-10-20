# Living studio motion

The existing visual identity, form layout, navigation and data flows are retained.

- Login and Home share a decorative SVG ink field. Threads bend toward the pointer; punctuation travels along the curves; clicks on non-control space create a dissipating ripple.
- The field stops updating while typing, off-screen, in a hidden tab, or when motion is paused/reduced. Listeners, observers and the GSAP ticker callback are removed on unmount.
- Login has interactive manuscript fragments with keyboard-accessible buttons and writing prompts. Decorative paper artwork cannot intercept those controls.
- Authentication invokes a native page transition only after the API succeeds. Unsupported/reduced-motion environments use the existing immediate handoff. Failed credentials never run a success transition.
- The homepage scratchpad gains a warm focus halo and a subtle quotation mark after writing starts.
- The existing pinned story gains perspective entrances, reversible text masks and gentle pointer tilt. The pin duration and native-scroll model are unchanged; mobile and reduced-motion layouts still expose every chapter.

Browser checks are in `tests/living-studio.mjs`, with existing coverage in `tests/bold-auth.mjs`, `tests/bold-story.mjs` and `tests/workspace-redesign.mjs`.

Verified production compilation and TypeScript checks. ESLint has no errors (one existing unused-variable warning in the real-finalization fixture). The new interaction/authentication test and the existing auth and story suites pass. Dark login and Home screenshots were visually inspected.
