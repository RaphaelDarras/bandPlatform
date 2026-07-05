---
phase: 05-online-shop-core
plan: 07
subsystem: ui
tags: [react, vitest, testing-library, tailwind, react-router, zustand]

# Dependency graph
requires:
  - phase: 05-online-shop-core (Plan 01)
    provides: fetchProduct client (web/src/lib/products.ts) and Product/Variant shared types
  - phase: 05-online-shop-core (Plan 04)
    provides: StockBadge (3-state) and QuantityStepper (controlled +/-) leaf components
  - phase: 05-online-shop-core (Plan 05)
    provides: useCartStore (zustand, persist+skipHydration) with addLine(line, stockCap)
provides:
  - ShopDetail.tsx — live-fetch product detail page (/shop/:id) with gallery, variant selector, per-variant stock, capped quantity, adjusted price, add-to-cart
affects: [cart-page, app-routes, checkout-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detail-page skeleton mirrors the catalog's pulse-block shape but as a single large aspect-square + text-bar column, for consistency across shop loading states"
    - "Conditional stock badge / disabled controls driven off a single derived `selectedVariant` value (product?.variants.find), reused for price, stepper max, and add-to-cart eligibility"

key-files:
  created:
    - web/src/pages/ShopDetail.tsx
    - web/src/pages/ShopDetail.test.tsx
  modified: []

key-decisions:
  - "Variant selection resets quantity to 1 (both on select and after add-to-cart) rather than preserving a stale quantity from a previously selected variant with different stock"
  - "Gallery thumbnail strip only renders when images.length > 1 (a single-image or no-image product shows just the primary tile, no redundant one-thumbnail row)"
  - "Retry re-triggers the fetch via a local 'attempt' counter bump, matching Shop.tsx's established pattern, rather than location.reload()"
  - "Product-not-found (missing :id) is treated as the same error/retry state as a fetch failure, rather than a distinct message — no route in this plan can actually produce a missing id, but the guard keeps fetchProduct's string-arg contract safe"

patterns-established:
  - "Add-to-cart payload assembly: { productId, variantSku, quantity, name, variantLabel, unitPrice: basePrice+priceAdjustment, image: images[0] ?? '' } passed to useCartStore.getState().addLine(line, variant.stock) — the payload shape future PDP-adjacent screens (e.g. Cart line editing) should match"

requirements-completed: [SHOP-08, SHOP-13]

# Metrics
duration: 8min
completed: 2026-07-05
---

# Phase 05 Plan 07: Product Detail Page Summary

**ShopDetail.tsx live-fetches a single product by :id (no loader, D-06) and renders an image gallery, a variant selector with out-of-stock muting (D-16), a per-variant StockBadge shown only after selection (D-17), a QuantityStepper capped at the variant's stock (D-18), the adjusted price (D-23), and an Add to Cart button wired to useCartStore.addLine.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-05T22:48:35Z
- **Completed:** 2026-07-05T22:56:00Z
- **Tasks:** 1 completed
- **Files modified:** 2 (both created)

## Accomplishments
- `ShopDetail.tsx` fetches `fetchProduct(id)` on mount via `useParams()`, with no loader export — keeping `/shop/:id` excluded from the SSG prerender pass (D-06).
- Image gallery: primary `aspect-square` image + thumbnail strip (shown only when >1 image), thumbnails swap the primary image on click (`aria-label="View image {n}"`), placeholder guard on `images[0]` truthiness (not `images.length`, Pitfall 4).
- Variant selector: one button per `variants[]` entry labeled via a size/color-join helper that never assumes both axes are present; selected state uses accent fill; out-of-stock (`stock === 0`) variants remain visible but `disabled` + `opacity-40 cursor-not-allowed` (D-16).
- Per-variant `StockBadge` renders only after a variant is selected (D-17); `QuantityStepper` is capped at `selectedVariant.stock` and disabled until a variant is chosen (D-18); price is `basePrice + selectedVariant.priceAdjustment` formatted `$X CAD` (D-23), always visible.
- "Add to Cart" is disabled (`bg-white/20 text-white/40 cursor-not-allowed`) until an in-stock variant is selected; on click it calls `useCartStore.getState().addLine(payload, selectedVariant.stock)` with the full snapshot payload, then resets quantity to 1.

## Task Commits

1. **Task 1: ShopDetail page — fetch, gallery, variant selector, stepper, add-to-cart**
   - `cd41762` feat(05-07): add product detail page with variant selection and add-to-cart

**Plan metadata:** commit pending (docs: complete plan, this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `web/src/pages/ShopDetail.tsx` - product detail page: fetch-on-mount, gallery, variant selector, stock badge, quantity stepper, price, add-to-cart
- `web/src/pages/ShopDetail.test.tsx` - fetch/error states, pre/post-selection disabled/enabled states, out-of-stock variant muting, addLine payload assertion, gallery thumbnail swap + empty-images placeholder

## Decisions Made
- Selecting a variant resets `quantity` to 1 (rather than clamping a stale quantity to the new variant's stock) — avoids a confusing "quantity silently changed" UX when switching between variants with different stock levels.
- Missing `:id` param is folded into the same error/retry UI as a fetch failure — no separate "not found" copy, since no route in this codebase can currently produce that case, but the guard keeps `fetchProduct(id: string)`'s contract type-safe without a non-null assertion.
- Reused Shop.tsx's exact error/retry block copy and `attempt`-counter retry pattern verbatim, per the plan's explicit instruction to mirror Shop's error-state shape.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ShopDetail.tsx` is fully live-fetch-driven and ready; the add-to-cart payload shape it establishes (`{ productId, variantSku, quantity, name, variantLabel, unitPrice, image }`) is the contract Cart.tsx (Plan 08) reads from `useCartStore.lines`.
- `App.tsx` route wiring for `shop/:id` (and `/cart`, `/checkout`) is NOT part of this plan's scope (`files_modified` lists only `ShopDetail.tsx`/`.test.tsx`) — confirmed by re-reading the actual 05-07-PLAN.md frontmatter, which does not list `App.tsx`. Route wiring is expected in a later wiring plan (05-09/10/11 in this phase's plan list).
- Verified via `npx tsc --noEmit` in `web/` (clean) and the full `npm run test -w web` suite (90/90 passing, no regressions in the other 18 test files).

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*

## Self-Check: PASSED

Both created files (ShopDetail.tsx, ShopDetail.test.tsx) verified present on disk; commit cd41762 verified present in git log.
