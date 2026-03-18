---
phase: 03-mobile-pos-optimization
plan: 01
subsystem: ui
tags: [react-native, stock, color-coding, pos, low-stock-warning]

# Dependency graph
requires:
  - phase: 02-mobile-pos-core
    provides: ProductTile, VariantPicker, stock screen, restock screen, SyncManager, CachedProduct type

provides:
  - stockColor() pure utility function with three-tier threshold (red/orange/gray)
  - Color-coded stock numbers in ProductTile (selling screen)
  - Color-coded per-variant stock in VariantPicker
  - Color-coded stock badge and variant rows in stock overview screen
  - Color-coded current stock display in restock adjustment screen
  - POS-06 and POS-11 closed with documentation comments in SyncManager

affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "stockColor(n) pure function: <=0 red, <5 orange, >=5 gray — single source of truth for stock color logic"
    - "minStock = Math.min(...variants.map(v => v.stock)) — drive tile-level color from worst-case variant"
    - "Inline style override: [styles.base, { color: stockColor(n) }] — overrides static stylesheet color without duplication"

key-files:
  created:
    - mobile/src/utils/stockColor.ts
    - mobile/src/__tests__/utils/stockColor.test.ts
  modified:
    - mobile/src/features/catalog/ProductTile.tsx
    - mobile/src/features/catalog/VariantPicker.tsx
    - mobile/src/app/(tabs)/stock.tsx
    - mobile/src/app/restock.tsx
    - mobile/src/features/sync/SyncManager.ts

key-decisions:
  - "stockColor thresholds: <=0 red (#ef4444), <5 orange (#f59e0b), >=5 gray (#888) — matches plan spec exactly"
  - "ProductTile uses minStock across all variants for single-color summary line — worst variant drives tile color"
  - "Sold-out variants remain tappable in both ProductTile and VariantPicker — concert sales never blocked"
  - "POS-06 closed via documentation: 60s periodic sync with backoff is sufficient, no battery optimizations needed"
  - "POS-11 closed via documentation: restock screen already satisfies reconciliation requirement"

patterns-established:
  - "stockColor pattern: import from @/utils/stockColor, apply via inline style override on stock text elements"

requirements-completed: [POS-06, POS-07, POS-11]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 03 Plan 01: Low-Stock Visual Warnings Summary

**stockColor() utility with red/orange/gray thresholds applied to 4 UI locations (ProductTile, VariantPicker, stock overview, restock screen), plus POS-06 and POS-11 closed with documentation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-18T20:20:00Z
- **Completed:** 2026-03-18T20:23:29Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Created `stockColor()` pure function with 9 unit tests covering all three zones and edge cases (TDD: RED then GREEN)
- Applied color coding to 4 UI locations: ProductTile stock summary (minStock), VariantPicker per-variant stockLabel, stock overview badge + variant rows, restock variant label with current stock display
- Closed POS-06 (battery efficiency) and POS-11 (end-of-event reconciliation) with documentation comments in SyncManager.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stockColor utility with tests** - `d5efc69` (feat) — TDD: tests first, then implementation
2. **Task 2: Apply stockColor to all stock-displaying UI locations** - `94b6a34` (feat)

_Note: Task 1 was TDD — tests written first (RED), implementation second (GREEN). No separate refactor commit needed for a 5-line function._

## Files Created/Modified
- `mobile/src/utils/stockColor.ts` - Pure stockColor() function with three-tier threshold logic
- `mobile/src/__tests__/utils/stockColor.test.ts` - 9 unit tests covering <=0, 1-4, >=5 zones with edge cases
- `mobile/src/features/catalog/ProductTile.tsx` - Added stockColor import, minStock computation, inline color override on stock summary text
- `mobile/src/features/catalog/VariantPicker.tsx` - Added stockColor import, per-variant inline color override on stockLabel
- `mobile/src/app/(tabs)/stock.tsx` - Added stockColor import, minStock for badge, per-variant stock text color override
- `mobile/src/app/restock.tsx` - Added stockColor import, color-coded "(stock: N)" current stock display next to variant labels
- `mobile/src/features/sync/SyncManager.ts` - Added JSDoc comments closing POS-06 and POS-11

## Decisions Made
- ProductTile uses `Math.min(...variants.map(v => v.stock))` — the worst-case variant drives the entire tile's stock color, consistent with user decision that "only the stock number text changes color"
- Sold-out (<=0) variants remain fully tappable — no disabled prop, no opacity — concert sales are never blocked

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in syncManager.test.ts, stock.test.ts, history.test.ts, and saleRecording.test.ts were discovered during full-suite verification. These failures are caused by working-tree changes from post-Phase 2 production fixes (not yet committed), and were present before plan 03-01 execution. Logged to `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- stockColor utility is available for any future stock-displaying screens
- Color coding is live across all stock UI surfaces — ready for user QA
- Pre-existing test failures in the working tree (SyncManager, stock, history, saleRecording) should be addressed before 03-02 execution to maintain test suite health

---
*Phase: 03-mobile-pos-optimization*
*Completed: 2026-03-18*
