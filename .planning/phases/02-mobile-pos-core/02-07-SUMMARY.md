---
phase: 02-mobile-pos-core
plan: 07
subsystem: mobile
tags: [react-native, expo-router, sqlite, zustand, tdd, offline-first, pos, sync, outbox, stock, products]

# Dependency graph
requires: [02-02, 02-04, 02-05, 02-06]
provides:
  - SyncManager with outbox processing, batching, exponential backoff, concurrent guard
  - useConnectivitySync hook triggering sync on offline->online transition
  - Periodic sync (startPeriodicSync/stopPeriodicSync with 60s interval)
  - Stock overview screen with expandable product rows and pull-to-refresh
  - Needs Reproduction section with red badge for negative-stock items
  - Restock screen (separate from stock, 4-step wizard, requires internet)
  - Product management CRUD (list, create, edit, deactivate — online only)
  - useStock hook with online/offline branch, needsReproduction computed list
  - api/inventory.ts (apiGetStock, apiRestock)
  - api/products.ts (apiGetProducts, apiCreateProduct, apiUpdateProduct, apiDeactivateProduct)
  - Dashboard sync indicator already wired to syncStore (isOnline, pendingCount)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SyncManager: module-level syncInProgress boolean as concurrent guard; sale_create rows batched; void/unvoid processed individually; exponential backoff min(1000*2^attempt, 30000ms)"
    - "useConnectivitySync: wasOfflineRef tracks previous state; triggers requestSync only on false->true transition"
    - "_resetSyncState export: allows test isolation of module-level singleton state"
    - "useStock: online fetches from API then reads cache; offline reads cache only; needsReproduction derived from products state"
    - "Stock screen: useFocusEffect auto-refresh + pull-to-refresh RefreshControl"
    - "Product screens: online-only guard at render time, shows offline placeholder"

key-files:
  created:
    - mobile/src/features/sync/SyncManager.ts
    - mobile/src/features/sync/useConnectivity.ts
    - mobile/src/features/stock/useStock.ts
    - mobile/src/api/inventory.ts
    - mobile/src/api/products.ts
    - mobile/src/app/restock.tsx
    - mobile/src/app/products/index.tsx
    - mobile/src/app/products/new.tsx
    - mobile/src/app/products/[id].tsx
    - mobile/src/__tests__/features/sync/syncManager.test.ts
    - mobile/src/__tests__/features/stock/stock.test.ts
  modified:
    - mobile/src/app/(tabs)/stock.tsx

key-decisions:
  - "SyncManager exports _resetSyncState for test isolation of module-level syncInProgress singleton — avoids jest.resetModules() overhead"
  - "useSyncStore.getState mock must be restored after jest.clearAllMocks() — clearAllMocks removes mockReturnValue implementations"
  - "getPendingOutboxRows mock uses mockReset() in beforeEach to clear queued mockResolvedValueOnce from prior tests that could corrupt subsequent test setup"
  - "useStock reads from local cache after API upsert (not directly from API response) — cache is always source of truth for offline-first consistency"
  - "Dashboard sync indicator already complete from plan 02-05: SyncIndicator component reads useSyncStore.isOnline and pendingCount, shows green/yellow/red dot"

requirements-completed: [POS-04, POS-01]

# Metrics
duration: 17min
completed: 2026-03-14
---

# Phase 2 Plan 7: Sync Manager, Stock Overview, and Product Management Summary

**Background sync engine (outbox processing with exponential backoff), stock overview with expandable rows and restock, and full product CRUD (online-only) using TDD throughout**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-14T15:27:55Z
- **Completed:** 2026-03-14T15:45:00Z
- **Tasks:** 2/2
- **Files modified:** 12 (11 created, 1 rewritten)

## Accomplishments

- Built SyncManager as a singleton background sync engine: processes pending outbox rows in batches of 10, batches all `sale_create` entries into a single `POST /sales/batch` call, processes `sale_void`/`sale_unvoid` individually, enforces concurrent sync prevention via module-level `syncInProgress` guard
- Exponential backoff formula: `min(1000 * 2^attempt_count, 30000ms)` — caps at 30 seconds
- After 3+ consecutive failures, `syncStore.incrementFailures` is called so UI can read `consecutiveFailures >= 3` to show alert
- useConnectivitySync subscribes to NetInfo, updates `syncStore.isOnline`, and fires `requestSync` only when transitioning from offline to online (wasOfflineRef tracks previous state)
- Periodic sync via `startPeriodicSync`/`stopPeriodicSync` (60s interval)
- Dashboard sync indicator was already complete (built in plan 02-05): reads `isOnline` and `pendingCount` from syncStore, shows green (online+synced), yellow (pending), red (offline)
- Built useStock hook: `refreshStock` online branch fetches from API and upserts to SQLite cache; offline branch reads cache directly; `restock` calls API then refreshes; `needsReproduction` computed filter for variants with stock < 0
- Stock tab fully rewritten: expandable product rows (collapsed: total stock, expanded: per-variant SKU/label/count), pull-to-refresh, auto-refresh on focus via `useFocusEffect`, Needs Reproduction section with red badge
- Restock screen: 4-step wizard (select product, select variant, enter quantity, optional reason), requires internet gate with clear message, navigates back on success
- Product management: list screen with active/inactive badges, + button, edit screen with pre-populated form, create screen with dynamic variant add/remove, deactivate button (soft delete with confirmation dialog)
- 21 new unit tests (13 sync + 8 stock), all passing. Total: 84 tests pass

## Task Commits

1. **Task 1 RED: Failing SyncManager tests** - `e84df02`
2. **Task 1 GREEN: SyncManager and connectivity hook** - `7b2cef1`
3. **Task 2 RED: Failing stock tests** - `aa1427a`
4. **Task 2 GREEN: Stock screens and product management** - `7518d99`

## Files Created

- `mobile/src/features/sync/SyncManager.ts` — requestSync (batching, backoff, guard), startPeriodicSync, stopPeriodicSync, _resetSyncState
- `mobile/src/features/sync/useConnectivity.ts` — useConnectivitySync hook
- `mobile/src/features/stock/useStock.ts` — refreshStock, restock, needsReproduction
- `mobile/src/api/inventory.ts` — apiGetStock, apiRestock
- `mobile/src/api/products.ts` — apiGetProducts, apiCreateProduct, apiUpdateProduct, apiDeactivateProduct
- `mobile/src/app/restock.tsx` — 4-step restock wizard with internet gate
- `mobile/src/app/products/index.tsx` — product list with add button and active badges
- `mobile/src/app/products/new.tsx` — product creation form with dynamic variants
- `mobile/src/app/products/[id].tsx` — edit form with deactivate button
- `mobile/src/__tests__/features/sync/syncManager.test.ts` — 13 unit tests
- `mobile/src/__tests__/features/stock/stock.test.ts` — 8 unit tests

## Files Modified

- `mobile/src/app/(tabs)/stock.tsx` — completely rewritten from placeholder stub

## Decisions Made

- **_resetSyncState export for tests:** The `syncInProgress` boolean is module-level state. Since Jest doesn't reset module state between tests in the same suite, the concurrent sync test would leave `syncInProgress = true`, corrupting subsequent tests. Exporting `_resetSyncState` is the minimal solution without `jest.resetModules()`.
- **useSyncStore.getState mock restoration:** `jest.clearAllMocks()` in `beforeEach` clears mock implementations (including `mockReturnValue` set at module mock time). The `useSyncStore.getState` must be restored to return `mockSyncStore` in `beforeEach` after `clearAllMocks()`.
- **mockReset for getPendingOutboxRows:** Tests that use `mockResolvedValueOnce` chains leave unspent Once implementations in the queue. Subsequent tests then receive wrong values because Once implementations take priority over the default. Using `mockReset()` in `beforeEach` clears the queue.
- **Cache as source of truth:** `useStock.refreshStock` upserts API data to cache then reads from cache (not from the API response directly). This keeps the offline path and online path symmetrical — both read from cache.
- **Dashboard already complete:** The sync indicator (`SyncIndicator` component reading `useSyncStore`) was built in plan 02-05. No changes needed in plan 02-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] _resetSyncState required for test isolation**
- **Found during:** Task 1 (TDD GREEN — test for 3 consecutive failures failed when run in sequence)
- **Issue:** Module-level `syncInProgress` boolean not reset between tests. The concurrent sync test used `mockReturnValueOnce` with an unresolved promise, which consumed the `syncInProgress` guard. By the time the "3 consecutive failures" test ran, `syncInProgress` was still true (the first sync hadn't been cleared), causing `requestSync` to return early before reaching the API call.
- **Fix:** Exported `_resetSyncState()` function; added call in `beforeEach` after `clearAllMocks()`.
- **Files modified:** `mobile/src/features/sync/SyncManager.ts`, `mobile/src/__tests__/features/sync/syncManager.test.ts`
- **Committed in:** 7b2cef1

**2. [Rule 1 - Bug] useSyncStore.getState mock cleared by clearAllMocks**
- **Found during:** Task 1 (same test failure investigation)
- **Issue:** `jest.clearAllMocks()` clears mock implementations (not just call records). The `useSyncStore.getState` mock was configured with `jest.fn(() => mockSyncStore)` at mock definition time, but `clearAllMocks()` removed that implementation, causing `getState()` to return `undefined` in subsequent tests.
- **Fix:** Added `(useSyncStore.getState as jest.Mock).mockReturnValue(mockSyncStore)` in `beforeEach` after `clearAllMocks()`.
- **Files modified:** `mobile/src/__tests__/features/sync/syncManager.test.ts`
- **Committed in:** 7b2cef1

**3. [Rule 1 - Bug] Leftover mockResolvedValueOnce corrupts subsequent tests**
- **Found during:** Task 1 (test ordering investigation — "updates pendingCount" test broke "triggers alert" test)
- **Issue:** The "updates pendingCount" test set `mockGetPendingOutboxRows.mockResolvedValueOnce([row]).mockResolvedValueOnce([])`. The second Once was never consumed (implementation changed to estimate remaining count rather than re-query). When the "triggers alert" test ran next, `mockResolvedValue([])` (the default) was shadowed by the unspent Once returning `[]`, causing `requestSync` to return early (no pending rows) without calling the API.
- **Fix:** Changed `beforeEach` to call `mockGetPendingOutboxRows.mockReset()` before setting `mockResolvedValue([])`. Same for `mockApiClient.post`.
- **Files modified:** `mobile/src/__tests__/features/sync/syncManager.test.ts`
- **Committed in:** 7b2cef1

---

**Total deviations:** 3 auto-fixed (all test isolation / mock management bugs, no architectural changes)
**Impact on plan:** Minor — test infrastructure corrections only; production code unaffected.

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm test` — 84 tests pass (13 new sync + 8 new stock + 63 from previous plans)
- SyncManager processes outbox with batching, exponential backoff, concurrent guard
- Connectivity hook triggers sync on offline→online transition
- Stock screen shows expandable products with per-variant stock counts
- Restock screen is separate (prevents misclicks), shows internet-required gate when offline
- Product list, create, edit, deactivate all work when online
- Dashboard sync indicator reflects actual status (already wired in plan 02-05)

## Self-Check: PASSED

All 9 created files verified on disk. All 4 task commits verified in git history.

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
