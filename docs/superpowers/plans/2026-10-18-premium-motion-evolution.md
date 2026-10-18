# Premium motion evolution

The user explicitly requests implementation without further design gates. Continue on `frontend-redesign`, preserving the existing information architecture, brand, real data and API contracts. Base: `46f5894`.

## Audit and direction

The existing editorial layouts, working lifecycle, scoped quality evidence and lavender/charcoal themes are strengths. Weak points: internal pages rely on one generic entrance; surfaces have little dimensional separation; authentication has useful paper parallax but little coordinated depth; navigation has abrupt active-state changes; asynchronous save/list states lack a shared interaction language. Stitch's fourteen reference screens remain useful for hierarchy, not for their fabricated data or decorative controls.

Compared three approaches: CSS-only polish is economical but cannot coordinate asynchronous groups well; a shader/Three.js scene adds weight unrelated to writing; extending the installed GSAP stack gives the best control and preserves the product. Select GSAP/ScrollTrigger with native scrolling, transform/opacity effects and minimal decorative lighting. No new libraries, backend changes or invented features.

Inspiration: Codrops' interpolated hover interactions and coordinated card previews, adapted to restrained paper depth rather than copied imagery or store interactions. References: https://tympanus.net/codrops/2020/07/01/creating-a-menu-image-animation-on-hover/ and https://tympanus.net/codrops/2025/05/27/animated-product-grid-preview-with-gsap-clip-path/ . Editorial hierarchy is consistent with the supplied Stitch guides and Awwwards typography/motion examples: https://www.awwwards.com/sites/invisible-north .

## Implementation boundaries

1. **Root: shared motion and surface system.** Create `components/motion/motion-scene.tsx` with scoped GSAP, cleanup, asynchronous-node discovery, once-only scroll reveals, restrained fine-pointer card depth and reduced-motion/failure fallback. Default content remains visible. No scroll interception, pinned writing surfaces or CSS that hides essential controls. Refine global elevation, texture, focus/press and feedback tokens. Integrate headings, dashboard, composer, selection, editor and research through data attributes; forms and focused writing surfaces remain spatially steady.
2. **Auth domain.** Evolve the existing paper composition with coordinated timeline, typographic reveals, SVG line work, multiple depth planes and pointer-responsive highlights; keep the form fixed, credentials/security hooks untouched and nonessential animation optional. Own auth component/CSS/tests only.
3. **Navigation domain.** Refine existing sidebar/header/theme navigation with a moving active indicator, icon/button micro-interactions and subtle theme feedback, preserving all labels, focus behavior, search and mobile drawer contracts. Own navigation components/local CSS/tests only; no global styles.
4. **Remaining pages domain.** Mark and refine profile/history/admin/legal/not-found/error surfaces, distinguish list, field and success feedback, preserve every real API action. Use the shared motion wrapper only for standalone routes; root already wraps workspace views. No API or business-logic edits.
5. **Root: visual iteration and proof.** Inspect rendered normal-motion and reduced-motion states in both themes at desktop/tablet/mobile; document at least three concrete iteration findings. Test pointer, scroll, keyboard, fast navigation, delayed API content, steady inputs, cleanup and reduced/coarse alternatives. Run existing six browser suites plus responsive and real-backend persistence checks, lint/types/build and backend regression tests. Independently review, push the requested branch and leave a local production build running.

## Motion contract

- `MotionScene({children, scene})` owns only descendants and cleans all timers, observers, listeners, tweens and triggers on replacement.
- `data-motion="heading|panel|card|bar|feedback|ornament"` opts into specific effects. Controls and fields are visible before animation setup; editor content has no tilt/parallax.
- Durations: press 100–140ms; UI changes 180–240ms; entrance 360–520ms; auth composition up to 900ms. Stagger 35–55ms, capped by group size. `power3.out` for reveals, a restrained overshoot only for decorative feedback.
- Pointer tilt at most 1.5 degrees, fine pointers only; measured on entry rather than every frame. Native focus/selection neutralizes decorative movement. Reduced motion and coarse pointers remove spatial effects.
- Scroll reveals occur once, just before viewport entry, without hiding focusable content. No fake live progress or repeated bouncing states. Async data uses the same semantic real API state.

## Verification record

Implementation complete. Final evidence is recorded in `docs/PREMIUM_MOTION_VERIFICATION.md`; local screenshots and diagnostic reports stay under ignored `scratch/`.
