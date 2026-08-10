---
phase: 07-shopify-integration
plan: 03
subsystem: ui
tags: [react, vite-react-ssg, shopify, zustand, dead-code-removal]

# Dependency graph
requires:
  - phase: 05-storefront (web half)
    provides: the self-built storefront + guest-checkout pages/components/libs now retired
  - phase: 07-shopify-integration (07-01/07-02)
    provides: Shopify as the storefront (shop.hurakanband.fr) that these entry points redirect to
provides:
  - Deleted self-built storefront + guest-checkout web code (7 pages, 3 components, 3 libs, 12 tests)
  - Cart-free Layout.tsx that keeps only the D-10 keep-alive /health ping
  - zustand uninstalled from the web workspace (no runtime consumer remained)
  - Verified SHOP-17 redirect (D-19): every Shop entry point opens the external Shopify storefront
affects: [phase-08, any-future-web-work, storefront]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External storefront: Shop nav + Home CTAs are plain external anchors (target=_blank, rel=noopener noreferrer) to shop.hurakanband.fr, not in-app routes"
    - "No in-app commerce state: zustand removed; localStorage cart rehydration gone from Layout"

key-files:
  created: []
  modified:
    - web/src/components/Layout.tsx
    - web/package.json

key-decisions:
  - "Redirect wiring is hardcoded to https://shop.hurakanband.fr/ (not env/config) — matches the shipped Header.tsx/Home.tsx pattern from commit 3b11655"
  - "Deleted orphaned format.ts along with its only importers (CatalogGrid/Checkout/Cart/ShopDetail)"

patterns-established:
  - "Storefront lives entirely off-origin on Shopify; the marketing site holds no commerce code or state"

requirements-completed: [SHOP-17]

# Metrics
duration: 6min
completed: 2026-08-10
---

# Phase 7 Plan 3: Retire Self-Built Storefront + Verify Shopify Redirect Summary

**Deleted the dark self-built storefront/guest-checkout web code (7 pages, 3 components, 3 libs, 12 tests), stripped cart rehydration from Layout, uninstalled zustand, and verified SHOP-17 (D-19) redirects every Shop entry point to shop.hurakanband.fr.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-10T22:40:00Z
- **Completed:** 2026-08-10T22:44:00Z
- **Tasks:** 2
- **Files modified:** 2 modified, 24 deleted

## Accomplishments
- Removed all dead storefront/checkout web code with no dangling imports (tsc clean).
- Layout.tsx now depends only on `pingHealth` (D-10 keep-alive); cart/localStorage rehydration removed.
- zustand uninstalled — its sole consumer (`cartStore.ts`) was deleted.
- SHOP-17 redirect verified end-to-end: Header nav + Home "Shop Now"/merch CTAs are external anchors to `shop.hurakanband.fr` with `target="_blank"` + `rel="noopener noreferrer"`; `App.tsx` declares no `/shop`, `/shop/:id`, `/cart`, or `/checkout*` route; `vercel.json` has no `/shop` rewrite.
- Full web test suite (158 tests, 21 files) green; SSG build green (only Home/listen/about/stock/contact/concerts rendered).

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead storefront/checkout code + edit Layout.tsx** - `87d8158` (refactor)
2. **Task 2: Uninstall zustand + verify SHOP-17 redirect** - `4faa0ac` (chore)

## Files Created/Modified
- `web/src/components/Layout.tsx` - Removed `useCartStore` import + cart-rehydration statements; kept `pingHealth()` in mount effect; updated leading comment.
- `web/package.json` - Removed `zustand` dependency.

### Deleted (24 files)
- Pages: `Shop.tsx`, `ShopDetail.tsx`, `Cart.tsx`, `Checkout.tsx`, `CheckoutCancel.tsx`, `CheckoutSuccess.tsx`, `PaypalReturn.tsx`
- Page tests: `Shop.test.tsx`, `ShopDetail.test.tsx`, `Cart.test.tsx`, `Checkout.test.tsx`, `CheckoutSuccess.test.tsx`, `PaypalReturn.test.tsx`
- Components: `CatalogGrid.tsx`, `StockBadge.tsx`, `QuantityStepper.tsx` (+ their `.test.tsx`)
- Libs: `cartStore.ts`, `orders.ts`, `format.ts` (+ `cartStore.test.ts`, `orders.test.ts`)

### Verify-only (already in target state from commit 3b11655)
- `web/src/App.tsx` — no internal storefront routes.
- `web/vercel.json` — no `/shop` rewrite.
- `web/src/components/Header.tsx` — external Shopify Shop link (unchanged; assertion in `Header.test.tsx` intact).
- `web/src/pages/Home.tsx` — external `shop.hurakanband.fr` CTAs (unchanged).

## Decisions Made
- The Shopify redirect is **hardcoded** to `https://shop.hurakanband.fr/` in `Header.tsx` and `Home.tsx` (not driven by env/config). This is the pattern already shipped in commit `3b11655`; the plan scoped this task as verify-only, so it was confirmed, not re-wired.

## Deviations from Plan
None - plan executed exactly as written. All target files not already in the end state were reconciled idempotently; the App.tsx/vercel.json/Header.tsx/Home.tsx facts from commit `3b11655` were already correct and left untouched.

## Issues Encountered
None. All 24 file deletions were intentional (deletion-focused plan). No lockfile changes were produced by the zustand uninstall (repo tracks no web lockfile).

## Threat Flags
None — no new security surface introduced. T-07-07 (`rel="noopener noreferrer"` on external Shop anchor) verified present and not weakened; T-07-08 (no reachable internal storefront route/rewrite) verified.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The marketing site is now free of self-built commerce code and state; the storefront lives entirely on Shopify.
- No blockers.

## Self-Check: PASSED

---
*Phase: 07-shopify-integration*
*Completed: 2026-08-10*
