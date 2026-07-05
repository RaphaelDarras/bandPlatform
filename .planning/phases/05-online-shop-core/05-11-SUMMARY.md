---
phase: 05-online-shop-core
plan: 11
subsystem: routing
tags: [react-router, vite-react-ssg, vercel, spa-fallback, ssg-prerender]

# Dependency graph
requires:
  - phase: 05-online-shop-core
    provides: Shop.tsx, ShopDetail.tsx, Cart.tsx, Checkout.tsx pages (Plans 06-09) and the app-wide route table (Plan 01)
provides:
  - Four shop routes registered in App.tsx (/shop, /shop/:id, /cart, /checkout), none with a loader
  - Scoped Vercel rewrite (/shop/(.*) -> /shop/index.html) so /shop/:id resolves on direct-link/refresh in production
  - Extended prerender-output test asserting shop shells build, /shop/:id stays un-prerendered, and the rewrite is present
affects: [phase-06-orders-payments, phase-07-shipping-checkout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic SSG routes excluded from prerender by omitting the loader key entirely (D-06), not via any special config"
    - "Scoped (not global) Vercel rewrite for SPA-fallback on a single dynamic segment, leaving filesystem-served static shells untouched"

key-files:
  created: []
  modified:
    - web/src/App.tsx
    - web/vercel.json
    - web/src/test/prerender-output.test.ts

key-decisions:
  - "Shop routes added before the '*' catch-all, matching react-router's ordered-match semantics"
  - "No loader key on any of the four shop routes — the absence itself is what excludes /shop/:id from vite-react-ssg's prerender pass"
  - "Rewrite scoped to /shop/(.*) only, not a global /(.*) catch-all, so unrelated bad paths still 404 (T-5-18)"

patterns-established:
  - "Pattern: static-shell negative assertion — walk dist/<route> and assert no nested per-id index.html exists, proving a dynamic route's prerender exclusion is real rather than accidental"

requirements-completed: [SHOP-01, SHOP-11]

# Metrics
duration: 2min
completed: 2026-07-05
---

# Phase 05 Plan 11: Shop Routing + Deploy-Safety Integration Summary

**Wired the four shop pages into the SSG route table with no loaders (keeping /shop/:id un-prerendered per D-06) and added the scoped Vercel rewrite that makes /shop/:id resolve on a direct link or hard refresh instead of 404ing.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-05T23:41:58+02:00
- **Completed:** 2026-07-05T23:43:33+02:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `/shop`, `/shop/:id`, `/cart`, `/checkout` all registered and reachable in the app, placed before the `*` catch-all so match order is correct
- `/shop/:id` deliberately carries no `loader:` key, so `vite-react-ssg build` never emits a static shell for it (live stock data is never baked into HTML)
- `web/vercel.json` now rewrites `/shop/(.*)` to `/shop/index.html` so a direct link or refresh on `/shop/<id>` resolves client-side instead of hitting a Vercel 404, without masking genuine 404s elsewhere via a global catch-all
- `prerender-output.test.ts` extended with three new assertions: shop/cart/checkout shells exist, no nested `dist/shop/<id>/index.html` exists, and the vercel.json rewrite is present and scoped

## Task Commits

Each task was committed atomically:

1. **Task 1: Register shop routes in App.tsx (no loaders → /shop/:id un-prerendered)** - `605dd6e` (feat)
2. **Task 2: Add scoped Vercel SPA-fallback rewrite for /shop/(.*)** - `301146a` (feat)
3. **Task 3: Extend prerender-output test — shop shells exist, no dynamic HTML, rewrite present** - `f6cc24c` (test)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `web/src/App.tsx` - Added shop/`:id`/cart/checkout child routes before the `*` catch-all; no loader on any; comment on `shop/:id` citing D-06
- `web/vercel.json` - Added scoped `rewrites` array with a single `/shop/(.*)` -> `/shop/index.html` entry
- `web/src/test/prerender-output.test.ts` - Added shop/cart/checkout to the emitted-routes list, a negative assertion for no per-product shell under `dist/shop`, and a JSON assertion on the vercel.json rewrite

## Decisions Made
- Shop routes placed before the `*` catch-all (react-router ordered match; a route after `*` would never be reached)
- No `loader:` key on any of the four shop routes — this omission is the entire mechanism by which `/shop/:id` is excluded from the prerender pass (contrast with Home/Concerts' `eventsLoader`)
- Rewrite scoped to `/shop/(.*)` rather than a global `/(.*)` SPA fallback, per the plan's threat register (T-5-18) — keeps unrelated broken links surfacing as real 404s
- No `$comment` key added to vercel.json (Vercel's schema rejects unknown keys — established in Phase 4 D-05)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Full build (`npm run build -w web`) and the full test suite (`npm run test -w web`, 22 files / 114 tests) pass after all three tasks, confirming the six pre-existing static shells, the three new shop-family shells, and the app_id-leak/unique-package-name assertions all remain green.

## User Setup Required

None - no external service configuration required. The `/shop/<id>` direct-link/refresh behavior on the live Vercel deploy should still be spot-checked manually after the next deploy (see Next Phase Readiness), since Vitest cannot exercise Vercel's actual rewrite engine.

## Next Phase Readiness

- Phase 05 (online-shop-core) routing and deploy-safety wiring is complete: SHOP-01 (routes reachable) and SHOP-11 (served over the existing HTTPS deploy, now including deep-link `/shop/:id`) are both satisfied.
- **Manual phase-gate checklist item (not automatable in Vitest — Pitfall 1):** after the next Vercel deploy, hard-refresh a real `https://<domain>/shop/<product-id>` URL directly (not via in-app navigation) and confirm it returns 200 with the product detail rendering, not a Vercel 404.
- Phase 6 (orders/payments) can build on this routing: Checkout's currently-disabled "Place Order" button and Cart's checkout link both already point at real, routed pages ready to receive live submit behavior.
