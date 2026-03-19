---
phase: 02-mobile-pos-core
plan: 08
subsystem: ui
tags: [sqlite, react-native, expo, history, sales, products]

# Dependency graph
requires:
  - phase: 02-mobile-pos-core
    provides: History screen, useHistory hook, getLocalSales, products API client

provides:
  - getLocalSales returns camelCase aliases for all snake_case SQLite columns
  - voidSale/unvoidSale accept optional items param for direct stock reversal
  - apiDeactivateProduct uses DELETE matching server route

affects: [03-mobile-pos-optimization, any phase using useHistory or getLocalSales]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SQL column aliasing to avoid camelCase/snake_case mismatch at query boundary
    - Optional items param pattern for hooks that may be called without pre-loaded state

key-files:
  created: []
  modified:
    - mobile/src/db/sales.ts
    - mobile/src/features/history/useHistory.ts
    - mobile/src/app/history/[saleId].tsx
    - mobile/src/api/products.ts

key-decisions:
  - "getLocalSales SELECT aliases all snake_case columns to camelCase at query level — removes need for runtime casts throughout the app"
  - "voidSale/unvoidSale accept optional items array — callers with pre-loaded parsedItems pass them directly, avoiding salesByGroup lookup that is empty in standalone screens"
  - "apiDeactivateProduct switched from PATCH to DELETE — server only exposes DELETE route for soft-delete deactivation"

patterns-established:
  - "SQL alias pattern: SELECT *, col_name AS camelName FROM table — all snake_case columns aliased at query boundary"

requirements-completed: [POS-03, POS-04, POS-09]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 02 Plan 08: UAT Bug Fixes Summary

**SQL column aliasing for discount_type/camelCase, items-param void for stock reversal, DELETE method for product deactivation — three UAT blockers closed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T13:00:54Z
- **Completed:** 2026-03-19T13:02:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `getLocalSales` now aliases all SQLite snake_case columns (`discount_type`, `total_amount`, `payment_method`, `concert_id`, `created_at`, `voided_at`, `items_json`) to their camelCase equivalents so `sale.discountType` resolves correctly in the sale detail screen
- `voidSale` and `unvoidSale` in `useHistory` now accept an optional `items` parameter — when provided the stock reversal uses it directly, fixing the bug where `SaleDetailScreen` called voidSale without first loading history (so `salesByGroup` was empty and stock was never restored)
- `apiDeactivateProduct` switched from `apiClient.patch()` to `apiClient.delete()`, matching the server's `DELETE /products/:id` route and eliminating the "Failed to deactivate product" error

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix discount type display and void stock reversal** - `8248ed1` (fix)
2. **Task 2: Fix product deactivation HTTP method** - `d43e565` (fix)

## Files Created/Modified

- `mobile/src/db/sales.ts` — `getLocalSales` SELECT now aliases snake_case columns; `LocalSaleRow` interface extended with camelCase alias fields
- `mobile/src/features/history/useHistory.ts` — `voidSale`/`unvoidSale` accept optional `items` param; grouping no longer needs `concert_id` cast
- `mobile/src/app/history/[saleId].tsx` — passes `sale.parsedItems` to `voidSale`/`unvoidSale`; uses `sale.totalAmount` and `row.concertId` directly (no casts)
- `mobile/src/api/products.ts` — `apiDeactivateProduct` uses `apiClient.delete()` with updated JSDoc

## Decisions Made

- SQL aliasing at query level is the cleanest solution — eliminates the need for runtime casts scattered across components and keeps the TypeScript type accurate
- Optional items param on voidSale/unvoidSale is backward compatible — existing callers that do load history first continue to work unchanged
- No request body sent to DELETE route — server sets `active: false` internally, so `{ active: false }` body parameter was unnecessary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all three bugs had clear root causes and straightforward fixes.

## Next Phase Readiness

- UAT gaps 16 (discount display, void stock reversal) and 18 (product deactivation) are now resolved
- All mobile app TypeScript compilation passes cleanly
- Ready to proceed with remaining Phase 3 plans

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-19*
