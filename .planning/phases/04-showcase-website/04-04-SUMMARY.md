---
phase: 04-showcase-website
plan: 04
subsystem: ui
tags: [react, vitest, react-router, static-content, jwt-migration]

# Dependency graph
requires:
  - phase: 04-showcase-website (04-01)
    provides: "App shell (Layout/Header/Footer), route stubs for About/Contact/Stock, Tailwind v4 theme tokens"
provides:
  - "About page (WEB-01): single hand-authored bio paragraph, no lineup section"
  - "Contact page (WEB-04): general + booking/press channels with mailto/Instagram/Bandsintown links, no form"
  - "Finalized Footer with /about, /contact, Email/Instagram/Bandsintown links"
  - "Migrated /stock React route: JWT login + inventory fetch + 401/403 handling, functionally equivalent to the legacy static page"
affects: [04-05-prerender-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stock-level color coding via Tailwind arbitrary-value hex classes shared with mobile theme (#ef4444/#f59e0b/#22c55e)"
    - "Client-side JWT auth pattern (sessionStorage token, Bearer header, 401/403 clears session) — isolated to the one runtime-fetch route in an otherwise SSG site"

key-files:
  created:
    - "web/src/pages/About.test.tsx"
    - "web/src/pages/Contact.test.tsx"
    - "web/src/pages/Stock.test.tsx"
  modified:
    - "web/src/pages/About.tsx"
    - "web/src/pages/Contact.tsx"
    - "web/src/pages/Stock.tsx"
    - "web/src/components/Footer.tsx"

key-decisions:
  - "Contact channels rendered as two h2-labeled blocks (General / Booking-Press) rather than a flat list — makes the D-16 split unambiguous to both visitors and tests"
  - "Placeholder emails (hi@hurakanband.fr / booking@hurakanband.fr) kept from the Plan 04-01 stub and marked with explicit TODO comments per D-16 — real addresses to be filled by the user before launch, not invented"
  - "Stock.tsx uses two separate useEffects (mount-time sessionStorage restore, then token-driven fetch) so both the initial-session-restore and post-login paths call the same loadStock function"

patterns-established:
  - "Migrated legacy static pages (website/*/index.html) become client-state React components preserving exact API contracts (auth headers, storage keys, status-code handling) with zero behavior change — visual/UX modernization deferred to a later pass"

requirements-completed: [WEB-01, WEB-04]

# Metrics
duration: 12min
completed: 2026-07-03
---

# Phase 4 Plan 04: About, Contact & Stock Migration Summary

**Single-paragraph About bio, two-channel static Contact page (general + booking/press), and a functionally-equivalent React port of the legacy JWT-gated /stock inventory page — closing WEB-01 and WEB-04 and completing the phase's route inventory.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-03T12:44:00Z
- **Completed:** 2026-07-03T12:56:24Z
- **Tasks:** 2
- **Files modified/created:** 7

## Accomplishments
- `/about` renders a single hand-authored bio paragraph under an "About" heading, with no lineup/member section (D-22/D-23).
- `/contact` renders two clearly-labeled channels — General and Booking/Press — each with a placeholder `mailto:` link marked `TODO`, plus Instagram and Bandsintown links; no `<form>` exists on the page (D-13/D-14/D-16).
- `Footer.tsx` links `/about` and `/contact` via `react-router` `Link`s (confirmed `Header.tsx` has zero references to either route — footer-only per D-15/D-24).
- `/stock` is fully migrated from `website/stock/index.html` into a React component: login form → `POST /api/auth/login` → `sessionStorage` token → `GET /api/inventory/stock` with `Authorization: Bearer` → 401/403 clears the token and returns to login. Stock-level color coding (`#ef4444`/`#f59e0b`/`#22c55e`) reuses the mobile app's danger/warning/success hex values. The Hewalk font reference is gone, replaced by the app's Bebas Neue display font.
- All 9 new tests pass; full `web/` suite (43 tests, 12 files) remains green after the change. `vite-react-ssg build` succeeds and emits all 6 route `index.html` files including `dist/stock/index.html`.

## Task Commits

1. **Task 1: About page (WEB-01) + Contact page (WEB-04) + Footer wiring** — `474895f` (feat)
2. **Task 2: Migrate /stock inventory page to a React route (D-05)** — `a906ccb` (feat)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `web/src/pages/About.tsx` — single-paragraph bio, no lineup section
- `web/src/pages/About.test.tsx` — asserts heading + exactly one bio `<p>`, no lineup/member text
- `web/src/pages/Contact.tsx` — General + Booking/Press channels, mailto/Instagram/Bandsintown links, TODO-marked placeholders, no form
- `web/src/pages/Contact.test.tsx` — asserts mailto + Bandsintown + Instagram links, two channel headings, absence of `<form>`
- `web/src/components/Footer.tsx` — comment updated to point at Contact.tsx's TODOs for the real address split (D-16); links/structure unchanged (already correct from Plan 04-01)
- `web/src/pages/Stock.tsx` — full JWT login + inventory fetch + 401/403-handling React port of `website/stock/index.html`
- `web/src/pages/Stock.test.tsx` — mocked-`fetch` coverage: default login view, successful login → stock render, 401 → back to login (token cleared)

## Decisions Made
- Contact channels use `<h2>` labels ("General", "Booking / Press") rather than inline list prefixes — gives the split a stable, testable structure and improves scannability for visitors.
- Kept the Plan 04-01 stub's placeholder addresses (`hi@hurakanband.fr` / `booking@hurakanband.fr`) rather than inventing new ones, and made the `TODO` markers explicit per the plan's acceptance criteria (grep-able in `Contact.tsx`).
- Stock.tsx splits session-restore (mount-only `useEffect` reading `sessionStorage`) from the fetch-on-token-change `useEffect` — mirrors the legacy script's `if (token) loadStock()` guard while keeping React's effect dependencies honest.

## Deviations from Plan

None — plan executed exactly as written. The pre-existing `web/tsconfig.json` project-reference `tsc --noEmit` error (TS6306/TS6310, referencing `tsconfig.node.json`) was verified present on a clean `git stash` of this plan's changes — it predates this plan and is out of scope (Scope Boundary: pre-existing issues in files this plan didn't touch). The actual build pipeline (`vite-react-ssg build`, which the project's `npm run build` script invokes — no separate `tsc --noEmit` gate) succeeds without it.

## Issues Encountered
None.

## User Setup Required

None for build/deploy — the site builds and runs without further configuration.

**Content the user should fill in before launch (flagged with `TODO` comments in source):**
- `web/src/pages/Contact.tsx` — real general fan-contact email (currently placeholder `hi@hurakanband.fr`), real booking/press email (currently placeholder `booking@hurakanband.fr`), and the real Instagram handle URL (currently `https://www.instagram.com/`).
- `web/src/components/Footer.tsx` — the general-channel email link mirrors the Contact.tsx placeholder and should be updated in lockstep.

## Next Phase Readiness
- Route inventory for the showcase site is now complete: `/`, `/discography`, `/concerts`, `/about`, `/contact`, `/stock` all render real content (no remaining stub pages).
- Plan 04-05 (prerender/deploy) can proceed with full-output assertions across all 6 routes, Vercel deployment, and DNS cutover.
- Outstanding non-blocking item: real contact addresses and Instagram handle (TODO-marked) should be supplied by the user before the domain cutover, though the site is fully functional with placeholders in the interim.

## Self-Check: PASSED

All 7 created/modified files verified present on disk; both task commits (474895f, a906ccb) verified in git history via `git log --oneline`.

---
*Phase: 04-showcase-website*
*Completed: 2026-07-03*
