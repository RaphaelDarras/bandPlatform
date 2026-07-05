---
phase: 05-online-shop-core
plan: 06
subsystem: ui
tags: [react, vitest, testing-library, tailwind, react-router]

# Dependency graph
requires:
  - phase: 05-online-shop-core (Plan 01)
    provides: fetchProducts/fetchProduct client (web/src/lib/products.ts) and Product/Variant shared types
provides:
  - Shop.tsx — live-fetch catalog page (/shop) with skeleton/cold-start/error/empty states
  - CatalogGrid.tsx — responsive product-card grid component (SHOP-07)
  - Documented D-25 manual product-creation procedure (no seed script/admin UI this phase)
affects: [product-detail-page, cart-page, App-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page delegates rendering to a grid/list component (Shop.tsx -> CatalogGrid, mirrors Concerts.tsx -> ConcertList)"
    - "useEffect-on-mount fetch with attempt counter for Retry re-trigger, plus a second useEffect timer for the D-10 cold-start note"

key-files:
  created:
    - web/src/components/CatalogGrid.tsx
    - web/src/components/CatalogGrid.test.tsx
    - web/src/pages/Shop.tsx
    - web/src/pages/Shop.test.tsx
  modified: []

key-decisions:
  - "CatalogGrid placeholder guards on images[0] truthiness (not images.length) so images: [''] still renders the branded placeholder, not a broken <img src=''> (Pitfall 4)"
  - "Shop.tsx Retry button bumps a local 'attempt' counter to re-run the fetch effect, rather than calling location.reload() — keeps the retry client-side and testable"
  - "Cold-start note driven by a second useEffect/setTimeout keyed on [products, error] rather than a single combined effect, so the skeleton and note timers are independently clear on unmount/success"

patterns-established:
  - "8-card pulse skeleton (bg-white/10 animate-pulse) matching the real card's aspect-square + two text-bar shape, reusable for future shop loading states (PDP skeleton in a later plan)"

requirements-completed: [SHOP-01, SHOP-07]

# Metrics
duration: 5min
completed: 2026-07-05
---

# Phase 05 Plan 06: Catalog Page Summary

**Shop.tsx live-fetches GET /api/products on mount and renders a responsive CatalogGrid (2/3/4-column, D-19 flat grid) with an 8-card pulse skeleton, a ~5s cold-start note, and a Retry-able error state — no seed script or admin UI built (D-25).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-05T22:39:22+02:00 (Task 1 RED)
- **Completed:** 2026-07-05T22:41:48+02:00 (Task 2 GREEN)
- **Tasks:** 2 completed
- **Files modified:** 4 (all created)

## Accomplishments
- `CatalogGrid` renders a responsive, linked product-card grid (`grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4`), each card a single `<Link to="/shop/:id">` with the branded no-image placeholder correctly guarding on `images[0]` truthiness (not `images.length`), plus a friendly empty-catalog message.
- `Shop.tsx` is the live `/shop` page: fetches `fetchProducts()` on mount (browser-only, no loader export, per D-05/D-06), shows an 8-card pulse skeleton while loading, surfaces the D-10 cold-start note after ~5s without removing the skeleton, and shows a Retry-able error block on fetch failure.
- Manual product-creation path (D-25) documented as a file-header comment in `Shop.tsx` and below — no seed script or product-creation UI was built this phase.

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Task 1; single feat commit for Task 2):

1. **Task 1: CatalogGrid responsive card grid**
   - `08ea3b6` test(05-06): add failing CatalogGrid test (RED)
   - `c9b5457` feat(05-06): implement CatalogGrid responsive product card grid (GREEN)
2. **Task 2: Shop catalog page with live fetch + skeleton/error/cold-start states + D-25 seed doc**
   - `6f102cb` feat(05-06): add Shop catalog page with live fetch + skeleton/cold-start/error states

**Plan metadata:** commit pending (docs: complete plan, this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `web/src/components/CatalogGrid.tsx` - responsive product-card grid; placeholder fallback guarded on `images[0]`; no stock badge (D-17); price formatted `$X CAD` (D-23); empty-catalog message
- `web/src/components/CatalogGrid.test.tsx` - populated grid (cards/links/name/price), empty-images placeholder, empty-string-images[0] placeholder (Pitfall 4), responsive grid classes, empty-catalog message
- `web/src/pages/Shop.tsx` - `/shop` page; runtime fetch via `fetchProducts()`; 8-card pulse skeleton; ~5s cold-start note; Retry-able error state; delegates success render to `CatalogGrid`; D-25 manual product-creation doc comment
- `web/src/pages/Shop.test.tsx` - loading skeleton, successful grid render, error/retry state, cold-start note timing (fake timers)

## Decisions Made
- Retry re-triggers the fetch via a local `attempt` counter state bump (not `location.reload()`) — keeps the retry path client-side, unit-testable, and consistent with the rest of the page's React state model.
- Cold-start note timer lives in its own `useEffect` keyed on `[products, error]` (distinct from the fetch-triggering effect keyed on `[attempt]`) so the 5s timer is cleanly cancelled on unmount or once the fetch resolves/rejects.
- Placeholder `<img>` uses `alt=""` (decorative) rather than `aria-hidden="true"`, matching the plan's guidance and keeping the element inspectable via `container.querySelectorAll('img')` in tests without ARIA-tree exclusion side effects.

## D-25 — Manual Product-Creation Procedure

There is intentionally **no seed script and no admin product-creation UI** this phase. Products are created via a manually-issued authenticated request:

```
POST /api/products
Authorization: Bearer <admin JWT>   (same login used by /stock)
Content-Type: application/json

{
  "name": "Tour Shirt",
  "description": "Optional",
  "category": "Optional",
  "basePrice": 25,
  "images": ["https://.../shirt-front.jpg", "https://.../shirt-back.jpg"],
  "variants": [
    { "sku": "TS-M-BLK", "size": "M", "color": "Black", "stock": 20, "priceAdjustment": 0 },
    { "sku": "TS-L-BLK", "size": "L", "color": "Black", "stock": 15, "priceAdjustment": 0 }
  ]
}
```

- Validation (see `api/routes/products.js`): `name`, `basePrice`, and a non-empty `variants` array are required; each variant needs a `sku` and at least one of `size`/`color`.
- `active` defaults to the Mongoose schema default (true) — omit it to have the product show up in the catalog immediately.
- Updates go through `PUT /api/products/:id` (product-level fields via a whitelist; variant `size`/`color`/`priceAdjustment` only — `stock`/`version` are protected and must go through `/api/inventory` endpoints).
- This procedure can be run with `curl` or Postman against the Render deployment using the existing `/stock` admin credentials; no new tooling was introduced.

## Deviations from Plan

None - plan executed exactly as written for both tasks.

## Issues Encountered

The cold-start-note test (fake timers advancing the `setTimeout`) initially failed because the resulting `setState` from the timer callback wasn't flushed synchronously under `vi.useFakeTimers()`. Wrapped `vi.advanceTimersByTimeAsync(5000)` in `@testing-library/react`'s `act()` to flush the React update — this is test-infrastructure only, no production code changed (not tracked as a Rule 1-3 deviation since it's a pre-existing testing-library/fake-timers interaction, not a bug introduced by this plan's code).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/shop` is fully live-fetch-driven and ready; `CatalogGrid` is reusable if a future plan needs a filtered/sub-grid view.
- `App.tsx` route wiring for `/shop`, `/shop/:id`, `/cart`, `/checkout` is NOT part of this plan (per `files_modified` scope) — expected to land in a later plan (05-07 per the phase's plan list) alongside `ShopDetail.tsx`.
- D-25 manual product-creation procedure is documented above; anyone testing the live catalog end-to-end needs to POST at least one product via this procedure first (the API returns an empty array otherwise, which correctly renders the empty-catalog message, not an error).

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*
