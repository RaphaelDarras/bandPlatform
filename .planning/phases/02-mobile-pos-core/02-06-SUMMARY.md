---
phase: 02-mobile-pos-core
plan: 06
subsystem: mobile
tags: [react-native, expo-router, sqlite, zustand, tdd, offline-first, pos, concerts, history, void-unvoid]

# Dependency graph
requires: [02-03, 02-04, 02-05]
provides:
  - Concert list screen with status badges and + New button
  - New concert quick-create form (name, venue, date, city) with validation
  - Concert detail with start selling / close / reopen actions and totals modal
  - Per-concert price overrides stored in SQLite concert_price_overrides table
  - Transaction history SectionList grouped by concert with VOIDED badges
  - Concert filter dropdown on history tab
  - Sale detail with full item breakdown, discount, totals, void/unvoid
  - useHistory hook with grouping, sorting, voidSale, unvoidSale (stock + outbox)
  - useConcerts hook with loadConcerts, createConcert, closeConcert, reopenConcert
affects: [02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useConcerts: online/offline branch in loadConcerts and createConcert; API calls with local cache upsert"
    - "useHistory: salesByGroup keyed by concertId, sorted newest first; voidSale/unvoidSale write outbox entry via db.runAsync directly"
    - "Sale detail: reads total_amount via snake_case cast since LocalSaleRow types it as totalAmount but DB returns snake_case"
    - "Concert close: totals calculated from getLocalSales (non-voided) before returning ConcertTotals"

key-files:
  created:
    - mobile/src/api/concerts.ts
    - mobile/src/api/sales.ts
    - mobile/src/db/concerts.ts
    - mobile/src/features/concerts/useConcerts.ts
    - mobile/src/features/history/useHistory.ts
    - mobile/src/app/concerts/index.tsx
    - mobile/src/app/concerts/new.tsx
    - mobile/src/app/concerts/[id].tsx
    - mobile/src/app/history/[saleId].tsx
    - mobile/src/__tests__/features/history/history.test.ts
  modified:
    - mobile/src/app/(tabs)/history.tsx

key-decisions:
  - "useConcerts.closeConcert calculates totals from local SQLite sales (not API) — offline-first, no network dependency for totals"
  - "useHistory.voidSale/unvoidSale insert outbox entry directly via db.runAsync (not via recordSaleLocally helper) — void is a separate operation type, not a new sale"
  - "LocalSaleRow total_amount: DB returns snake_case column names; accessed via cast to Record<string, number> since TypeScript types it as totalAmount (camelCase inheritance from LocalSale)"
  - "apiVoidSale/apiUnvoidSale called as best-effort in voidSale/unvoidSale — outbox entry handles retry if offline"

requirements-completed: [POS-03]

# Metrics
duration: 14min
completed: 2026-03-14
---

# Phase 2 Plan 6: Concert Management and Transaction History Summary

**Concert CRUD screens (list, create, detail/close) and transaction history with void/unvoid capability: SectionList grouped by concert, sale detail with full breakdown, outbox-backed void/unvoid with local stock adjustment**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-14T15:09:31Z
- **Completed:** 2026-03-14T15:23:34Z
- **Tasks:** 2/2
- **Files modified:** 11 (10 created, 1 rewritten)

## Accomplishments

- Built complete concert management: list with status badges, quick-create form with 4-field validation, detail screen with start selling / close / reopen actions
- Concert close shows a totals modal with total revenue, transaction count, and items sold (calculated from local SQLite sales, non-voided only)
- Per-concert price overrides UI: add/update/remove overrides stored in the existing `concert_price_overrides` SQLite table
- Reopen concert button allows reopening closed concerts (Claude's discretion as specified in plan)
- Transaction history tab completely rebuilt: SectionList with concert group headers, sale rows with VOIDED badge, concert filter dropdown, pull-to-refresh
- Sale detail screen: all items with variant SKU, quantity, unit price, line total; discount summary; void/unvoid buttons with confirm dialogs
- useHistory hook: groups sales by concertId, sorts newest first within group, voidSale reverses stock (+delta), unvoidSale re-deducts (-delta), both create outbox entries
- 8 unit tests for useHistory covering grouping, sorting, voided flag, voidSale calls, stock adjustment, outbox insertion, unvoidSale calls and stock re-deduction

## Task Commits

1. **Task 1: Concert management screens** - `81470aa`
2. **Task 2: TDD RED — failing tests for useHistory** - `274b192`
3. **Task 2: Transaction history tab and sale detail with void/unvoid** - `799aa0c`

## Files Created

- `mobile/src/api/concerts.ts` — apiGetConcerts, apiCreateConcert, apiGetConcert, apiPatchConcert
- `mobile/src/api/sales.ts` — apiGetSales, apiVoidSale, apiUnvoidSale
- `mobile/src/db/concerts.ts` — getCachedConcerts, getConcertById, upsertConcerts, upsertConcert, updateConcertActive, price override CRUD
- `mobile/src/features/concerts/useConcerts.ts` — loadConcerts (online/offline), createConcert, closeConcert (with totals), reopenConcert, getConcertTotals, activeConcert
- `mobile/src/features/history/useHistory.ts` — loadHistory with grouping/sorting, voidSale, unvoidSale
- `mobile/src/app/concerts/index.tsx` — FlatList, status badges, + New button, pull-to-refresh
- `mobile/src/app/concerts/new.tsx` — 4-field form with YYYY-MM-DD date input and validation
- `mobile/src/app/concerts/[id].tsx` — concert detail, close modal with totals, reopen, price overrides editor
- `mobile/src/app/history/[saleId].tsx` — sale detail, items table, discount/total summary, void/unvoid actions
- `mobile/src/__tests__/features/history/history.test.ts` — 8 unit tests (TDD)

## Files Modified

- `mobile/src/app/(tabs)/history.tsx` — completely rewritten (was a placeholder stub)

## Decisions Made

- **closeConcert uses local SQLite for totals:** Totals (revenue, transaction count, items sold) are calculated from `getLocalSales` filtering non-voided sales. This avoids network dependency for what should be an offline-capable operation.
- **useHistory void outbox via db.runAsync:** Void/unvoid create outbox entries by calling `db.runAsync` directly with an `INSERT OR IGNORE INTO outbox` statement. Using `recordSaleLocally` would be incorrect since that helper inserts a new sale row. The outbox pattern is the same but the sale row already exists.
- **LocalSaleRow total_amount cast:** The `LocalSaleRow` type inherits `totalAmount` (camelCase) from `LocalSale`, but the actual SQLite query returns snake_case column names. Accessed via `(row as unknown as Record<string, number>)['total_amount']` where the amount is needed. This is a pre-existing type/column naming mismatch in the codebase.
- **apiVoidSale/apiUnvoidSale best-effort:** Both void and unvoid immediately attempt an API call after the local SQLite write and outbox insert. If the network call fails (offline), the outbox entry handles the retry on next sync.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LocalSaleRow total_amount TypeScript error**
- **Found during:** Task 1 (TypeScript compilation of useConcerts.ts)
- **Issue:** `LocalSaleRow` types the total field as `totalAmount` (inherited from `LocalSale`) but SQLite returns `total_amount` (snake_case column). TypeScript error: `Property 'total_amount' does not exist on type 'LocalSaleRow'`.
- **Fix:** Used `((s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0)` to access the actual runtime column name while satisfying TypeScript. Applied consistently in both `closeConcert` and `getConcertTotals`.
- **Files modified:** `mobile/src/features/concerts/useConcerts.ts`
- **Committed in:** 81470aa

**2. [Rule 1 - Bug] Test mockDb missing runAsync**
- **Found during:** Task 2 (TDD GREEN — tests failing with `TypeError: db.runAsync is not a function`)
- **Issue:** The `getDb` mock in the test file returned `{ _mock: 'db' }` which lacks `runAsync`. The useHistory `voidSale` function calls `db.runAsync` to insert an outbox entry.
- **Fix:** Declared a named `mockDb` object with all required SQLite methods as jest.fn(), used it in the `getDb` mock, and reset it in `beforeEach` after `jest.clearAllMocks()`. Also removed a duplicate inner `mockDb` variable in test 4 that was shadowing the outer one.
- **Files modified:** `mobile/src/__tests__/features/history/history.test.ts`
- **Committed in:** 799aa0c

**3. [Rule 2 - Missing mock] apiVoidSale/apiUnvoidSale not mocked in tests**
- **Found during:** Task 2 (tests would have failed with network errors)
- **Issue:** The useHistory hook calls `apiVoidSale` and `apiUnvoidSale` after local operations. These were not mocked in the test file, which would cause network errors or failures in the test environment.
- **Fix:** Added `jest.mock('@/api/sales', ...)` block to the test file mocking all three sales API functions.
- **Files modified:** `mobile/src/__tests__/features/history/history.test.ts`
- **Committed in:** 799aa0c

---

**Total deviations:** 3 auto-fixed (1 TypeScript type bug, 1 test mock setup bug, 1 missing mock)
**Impact on plan:** Minor — all correctness fixes, no architectural changes.

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm test` — 63 tests pass (8 new history tests + 55 from previous plans)
- Concert list shows concerts with active/closed status badges
- New concert form validates all 4 fields (name, venue, date YYYY-MM-DD, city)
- Concert detail shows close button (opens totals modal) and start selling button
- Per-concert price overrides editable from concert detail
- History tab shows SectionList grouped by concert, newest sales first
- Sale rows show VOIDED badge when voided=1
- Concert filter dropdown works in history tab
- Sale detail shows all items, variant SKUs, quantities, prices, discount, total
- Void/unvoid buttons with confirm dialogs, create outbox entries for sync

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
