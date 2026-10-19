# Bold motion evolution

Base: `688c48d`, branch `frontend-redesign`. Preserve the current brand, layouts, typography, data and API behavior.

Compared three creative directions: a kinetic type studio, a constellation of ideas, and a paper theatre. The paper theatre fits the existing editorial identity best; typography and cursor-reactive contour planes support it. Retain Merriweather/Lato and the existing palette rather than applying the motion skill's unrelated font/layout randomization to an established product.

## Composition

- Cinematic login: large paper fan assembly, depth and orbit drawing, masked line entrances, stronger bounded pointer parallax, locally lit papers. Inputs and button hit targets remain fixed.
- Shared scenes: word-level headings, dimensional paper entrances, a clipped oversized scene echo, page rule transition, stronger interactive card tilt and magnetic button icons inside fixed targets.
- Atmosphere: three pointer-reactive background planes rendered with SVG/CSS and transform-based GSAP motion. No new runtime or WebGL dependency is needed.
- Native scroll story: three explanatory paper chapters after the existing dashboard tools. Desktop pin spans at most 950px; skip link moves focus beyond it. Mobile, short viewports and reduced/paused motion show normal stacked content. The CTA opens the real composer.
- Global control: persistent Pause/Resume motion, with OS reduction taking precedence. Failed browser storage must not prevent live control. Dialog entry/exit animations are removed when paused, never frozen mid-exit.

## Verification

Measure actual entrance/pointer travel, card transforms, real pin position and scroll-dependent transforms. Verify paused/reduced/touch alternatives, pin removal, keyboard focus, stationary form targets, failed storage, modal dismissal, route cleanup, and real composer navigation. Run existing smoke/motion/responsive suites, production build, lint/types, and isolated real API persistence checks. Inspect screenshots in both themes and mobile; refine contrast, decorative intensity and control spacing.

Inspiration: [Codrops scroll typography](https://tympanus.net/Development/ScrollTextMotion/) and [Awwwards scroll interaction examples](https://www.awwwards.com/inspiration/scroll-portfolio). These inform choreography, not copied assets or invented product data.

## Animated sidebar extension

Keep the existing navigation and brand, using an 80px icon rail versus the expanded 236px sidebar. Width and main-content inset share a 560ms eased transition; labels recede, the toggle chevron rotates, and account/theme/legal actions stay reachable with accessible names and native tooltips. The compact preference uses a hydration-safe external store and continues to work when storage fails. Mobile retains the full Radix drawer, with a visible close control. Reduced or paused motion removes transitions. Refresh ScrollTrigger measurements after width changes. Verify interpolation and matched rail/inset geometry, rapid reversals, keyboard activation, refresh persistence, theme/navigation controls, storage failures and mobile overflow.
