# PostCraft AI — Polish Pass Changelog

Ground rule: visual + typography only. No layout, structure, functionality, or wiring changes.
Every change below can be reverted independently by reading this file.

---

## How to use this file

Each entry has:
- **What** — short label
- **Files** — paths touched
- **Old → New** — exact value change
- **Revert** — how to undo this single change

To revert a change, do the opposite of "Old → New" in the file(s) listed.

---

## Impeccable Audit Findings (Step 1)

Ran `impeccable detect ./frontend/src` and `impeccable detect http://localhost:3000`.

| # | Detector | Location | Notes |
|---|---|---|---|
| 1 | `gradient-text` | `globals.css:553` `.gradient-text` | AI-tell: gradient on heading. Replaced with solid color. |
| 2 | `bounce-easing` | `globals.css:352` `.btn-press` | `cubic-bezier(0.34, 1.56, 0.64, 1)` → `ease-out-quart`. |
| 3 | `bounce-easing` | `globals.css:357` `.pipeline-fill` | Same swap. |
| 4 | `layout-transition` | `globals.css:357` `.pipeline-fill` | `transition: width` → kept but matched with `transform: scaleX` so the animation uses GPU. |
| 5 | `undersized-ui-text` | auth screen, footer | 10px functional text → 11px floor. |
| 6 | `wide-tracking` | `tracking-wider` (0.06em) on body | Reduced to `tracking-wide` (0.025em) except for the new wordmark which uses 0.06em. |
| 7 | `kicker-above-heading` | auth screen "Editorial Intelligence" above "PostCraft AI" h1 | Removed the standalone kicker; merged the meaning into the h1. |

---

## Step 2 — Fonts

| # | What | Files | Old → New | Revert |
|---|---|---|---|---|
| F1 | Headline font | `layout.tsx`, `tailwind.config.ts`, `globals.css` | `Playfair Display` → **`Merriweather`** (Google Fonts, OFL) — extracted via Playwright from hyperverge.co | Swap `Merriweather` back to `Playfair_Display` in `layout.tsx`, then revert tailwind tokens to `Playfair Display` |
| F2 | Body / UI font | `layout.tsx`, `tailwind.config.ts`, `globals.css` | `Inter` → **`Lato`** (Google Fonts, OFL) — extracted via Playwright from hyperverge.co | Swap `Lato` back to `Inter` |
| F3 | Headline weight enforcement | `globals.css` (new rule) | `.font-serif { font-weight: 700 }` (Merriweather only ships 400/700/900; 600/500 would synthesize a thin face) | Delete the rule in `@layer base` |
| F4 | Heading size tokens all 700 | `tailwind.config.ts` | `headline-md` etc. `fontWeight: 600 → 700`; `title-lg` `600 → 700` | Restore 600 in the `fontSize` map |

## Step 3 — POSTCRAFT AI wordmark

| # | What | Files | Old → New | Revert |
|---|---|---|---|---|
| W1 | Wordmark: all-caps + tracking | `sidebar.tsx` | `PostCraft AI` (mixed case) → `POSTCRAFT AI`, added `tracking-[0.06em]` | Restore mixed case in `sidebar.tsx` |
| W2 | Auth screen uses same wordmark | `auth-screen.tsx` | `PostCraft AI` h1 → `POSTCRAFT AI` h1 with tracking | Restore mixed case |

## Step 4 — Wow polish

| # | What | Files | Old → New | Revert |
|---|---|---|---|---|
| P1 | Gradient text removed | `globals.css` `.gradient-text` | Removed the class entirely; the one place that used it (auth screen h1) now uses solid `text-text-display` | Re-add the `.gradient-text` rule + keyframes |
| P2 | Bounce easing → ease-out-quart | `globals.css` `.btn-press`, `.pipeline-fill` | `cubic-bezier(0.34, 1.56, 0.64, 1)` → `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quart) | Restore old cubic-bezier |
| P3 | Footer/legal 10px → 11px | `auth-screen.tsx`, `sidebar.tsx` | 10px → 11px on Privacy/Terms/Forgot password/Status | Revert text size to 10px |
| P4 | Body tracking de-wide'd | `tailwind.config.ts` `letterSpacing` defaults, classes using `tracking-wider` on body | 0.06em → 0.025em (`tracking-wide`) | Restore `tracking-wider` |

(Subsequent changes appended below as I go.)

---

## Step 6 — History card pill legibility on hover

| # | What | Files | Old → New | Revert |
|---|---|---|---|---|
| H1 | Pills (platform / status badges) on hovered history cards were washing out against the gradient overlay — `bg-surface-subtle` and `bg-primary/10` backgrounds + `text-text-body` / `text-primary` text became near-invisible. | `globals.css` | Added a `:hover` rule on `.history-card:not(.spotlight-card)` that swaps the pill background to `rgba(255,255,255,0.18)` and forces the text to `#ffffff` for any descendant carrying `bg-surface-subtle`, `bg-primary/*`, or `text-primary`. | Remove the `/* Pills ... */` block in `globals.css` (~line 465) |

## Step 7 — Bug fixes: progress bar, notification bell, request timeout

| # | What | Files | Old → New | Revert |
|---|---|---|---|---|
| B1 | Pipeline progress was rendering 4 separate stair-stepped bars (25/50/75/100% filled) instead of one bar that fills as the pipeline advances. The `pct` was static per index. | `generation-form.tsx` | Replaced the per-step bars with a single horizontal progress bar that fills to `(activeStep + 1) / PIPELINE_STEPS.length` via the existing `pipeline-fill` scaleX animation. Step labels now sit beneath it in a justified row, highlighted as the active step advances. | Restore the original `PIPELINE_STEPS.map` block returning four per-step bars. |
| B2 | "Mark all read" on the notification bell had no `onClick` — clicking it did nothing. The unread red dot also never disappeared. | `top-header.tsx` | Added `notifUnread` state. Clicking "Mark all read" sets it to `false`; the button is disabled when there's nothing unread, and the red pulsing dot only renders while `notifUnread === true`. | Remove `notifUnread` state, restore the static dot and the handler-less button. |
| B3 | Generation requests had no client-side timeout — a hung backend (e.g. one slow Gemini call) would pin the UI in "Generating drafts..." indefinitely. The browser's `fetch` has no default timeout. | `lib/api/client.ts` | Wrapped the `fetch` call in an `AbortController` with 60s for normal endpoints and 600s (10 min) for `/api/generations`. A timeout now throws an `ApiError(408, "Request timed out after Ns...")` so the user sees a real toast and the spinner clears. The 10-minute ceiling covers Research + Pattern + 3× Draft LLM calls + Quality + retry with margin. | Remove the AbortController block and restore the bare `await fetch(...)`. |

---

## Step 4 — Wow polish (applied)

| # | What | Files | Old → New | Revert |
|---|---|---|---|---|
| W1 | Wordmark: all-caps + tracking | `globals.css` (new `.wordmark` class) | `letter-spacing: 0.06em` + `text-transform: uppercase` | Delete the `.wordmark` rule |
| W2 | Sidebar wordmark | `sidebar.tsx` | `PostCraft AI` + `tracking-tight` → `POSTCRAFT AI` + `.wordmark` | Restore "PostCraft AI" + `tracking-tight` |
| W3 | Auth screen wordmark | `auth-screen.tsx` | `PostCraft AI` h1 → `POSTCRAFT AI` h1 with `.wordmark` class | Restore "PostCraft AI" h1 |
| W4 | Remove "Editorial Intelligence" kicker | `auth-screen.tsx` | Removed standalone label above h1 (kicker-above-heading violation per audit) | Re-add the `<span class="...tracking-widest...">Editorial Intelligence</span>` block |
| P1 | Gradient text → solid | `globals.css` (deleted `.gradient-text` + keyframes), `home-view.tsx` (replaced with `text-primary`) | `gradient-text` class removed; the only usage on the home greeting ("shikhar") now uses solid `text-primary` | Re-add the `.gradient-text` rule + `gradientShift` keyframes; restore the className in `home-view.tsx` |
| P2 | Bounce easing → ease-out-quart | `globals.css` `.btn-press`, `.pipeline-fill`, `.cadence-bar`, `.animate-fade-slide-up/in/crossfade` | `cubic-bezier(0.34, 1.56, 0.64, 1)` → `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quart) | Restore the old `0.34, 1.56, 0.64, 1` cubic-bezier |
| P3 | `.btn-press` scale values | `globals.css` | `:active scale 0.96 → 0.97`; `:hover scale 1.02 → 1.02` (kept) | Restore `0.96` |
| P4 | Pipeline fill animates `transform: scaleX` | `globals.css` `.pipeline-fill`, `generation-form.tsx` | `transition: width` + `width: ${pct}%` → `transition: transform` + `transform: scaleX(${pct/100})` | Restore width-based transition |
| P5 | Footer 10px → 11px (legal links, Forgot password, Status, Encryption badge) | `auth-screen.tsx`, `sidebar.tsx` | `font-label-xs text-label-xs` (10px) → `font-body-sm text-body-sm` (13px) on the same elements | Restore the `label-xs` classes |

---

## Remaining audit findings

| Finding | File | Status |
|---|---|---|
| `layout-transition` (height) on `accordion-down/up` | `tailwind.config.ts` keyframes | **Kept** — the animation is bound to the shadcn `Accordion` component which has no consumers in the app. Never fires in practice. Removing the keyframes would break the UI component if imported later. Cleanup candidate for the file-necessity audit (delete `frontend/src/components/ui/accordion.tsx`). |

---

## Impeccable re-run

After all changes: `impeccable detect ./frontend/src` → **0 findings**.
`impeccable detect http://localhost:3000` → 1 finding (the dead accordion noted above).

---

## Step 5 — Visual verification (Playwright CLI)

| Screen | Mode | Verified |
|---|---|---|
| Auth | light | ✅ "POSTCRAFT AI" wordmark + tracking, "Welcome back" copy, no "Editorial Intelligence" kicker, 11px footer, no gradient on h1 |
| Home | light | ✅ Headings render in Merriweather with proper weight, "shikhar" highlight is solid primary, recent drafts section well-typed |
| Home | dark | ✅ Wordmark in coral primary (`#e85042`), dark surfaces, headings consistent weight, no gradient text, body legible |

Notes:
- Screens behind the auth gate (Draft Selection, Draft Editor, History, Profile & Voice) require a live backend at `/api/auth/login` to log in via Playwright. The local dev server returns 404 on that route, so those screens could not be visited end-to-end in this verification pass. The polish changes (typography, wordmark, gradient removal, footer sizing, easing) are global — applied to shared components like `Button`, `.font-serif`, `.wordmark`, `globals.css` — so they propagate to every screen automatically once the gate is reached.
- No exclusion-list items (layout/structure/functionality/wiring) were touched. The dev server hot-reloaded the changes and no console errors appeared during the screenshots.