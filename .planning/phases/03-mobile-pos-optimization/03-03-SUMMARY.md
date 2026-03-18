---
phase: 03-mobile-pos-optimization
plan: 03
subsystem: ui
tags: [react-native, zustand, sync, dashboard, offline-first]

# Dependency graph
requires:
  - phase: 03-mobile-pos-optimization
    provides: SyncManager with requestSync, syncStore with lastSyncAt/consecutiveFailures, useStock hook
provides:
  - Enhanced SyncIndicator showing "Online · 2min ago" relative timestamp format
  - Sync Now button (↻ icon) with ActivityIndicator spinner while syncing
  - Cold-start protection: Start Selling card disabled when products.length === 0
  - formatRelativeTime utility for relative timestamp display
  - Unit tests for formatRelativeTime and Sync Now behavior
affects: [dashboard-ui, sync-ui, cold-start, product-availability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Relative time formatting via dedicated utility (formatRelativeTime)
    - disabled prop pattern on ActionCard interface for conditional card state
    - cardDisabled style placed after cardPrimary in StyleSheet array to override blue background with gray when disabled

key-files:
  created:
    - mobile/src/utils/formatRelativeTime.ts
    - mobile/src/__tests__/utils/formatRelativeTime.test.ts
    - mobile/src/__tests__/features/sync/syncIndicator.test.ts
  modified:
    - mobile/src/app/(tabs)/index.tsx

key-decisions:
  - "handleSyncNow uses local useState syncing flag (not syncStore) — spinner state is purely local UI concern, does not need persistence or global access"
  - "cardDisabled style appears after cardPrimary in StyleSheet array — CSS-like cascade ensures gray background overrides blue for disabled primary card"
  - "Sync Now tests are unit-level (testing callback logic directly) rather than component render tests — avoids expensive DashboardScreen render with all its dependencies"

patterns-established:
  - "disabled?: boolean on ActionCard interface + cardDisabled style + disabled={card.disabled} on Pressable — pattern for conditional card disabling"
  - "fullLabel = lastSyncLabel ? `${statusLabel} · ${lastSyncLabel}` : statusLabel — compact conditional label composition"

requirements-completed: [POS-12]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 3 Plan 03: Sync Indicator Enhancement Summary

**Dashboard SyncIndicator enhanced with relative last-sync timestamp, manual Sync Now button with spinner, and cold-start disabled Start Selling card when no products are cached**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T20:52:26Z
- **Completed:** 2026-03-18T20:54:40Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- SyncIndicator now shows "Online · 2min ago" format using `lastSyncAt` from syncStore via `formatRelativeTime`
- Color logic updated: orange when `pendingCount > 0` OR `consecutiveFailures > 0` (previously only pendingCount)
- Sync Now button (↻) always visible next to indicator; shows ActivityIndicator spinner while syncing; calls `requestSync(db, apiClient)` on tap
- Start Selling card disabled and greyed out (opacity 0.5, gray background) when `products.length === 0`, showing "Connect to internet to load products first" subtitle
- 8 unit tests pass: 4 for formatRelativeTime edge cases, 4 for Sync Now callback behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance SyncIndicator and add cold-start disabled state** - `e35b50d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `mobile/src/utils/formatRelativeTime.ts` - Utility converting timestamp to relative string ("just now", "1min ago", "5min ago")
- `mobile/src/app/(tabs)/index.tsx` - Enhanced SyncIndicator, Sync Now button, disabled ActionCard support, cold-start Start Selling protection
- `mobile/src/__tests__/utils/formatRelativeTime.test.ts` - Unit tests for formatRelativeTime (4 cases)
- `mobile/src/__tests__/features/sync/syncIndicator.test.ts` - Unit tests for Sync Now callback logic (4 cases)

## Decisions Made

- `handleSyncNow` uses local `useState` syncing flag (not syncStore) — spinner state is purely local UI concern, does not need persistence or global access
- `cardDisabled` style placed after `cardPrimary` in StyleSheet array — ensures gray background overrides blue for disabled primary card
- Sync Now tests written at unit level (testing callback logic directly) rather than full component render — avoids expensive DashboardScreen render with all its dependencies while still verifying the core behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures (4 suites, 9 tests) in `syncManager.test.ts`, `stock.test.ts`, `history.test.ts`, and `saleRecording.test.ts` were present before this plan and are unrelated to these changes. Verified via `git stash` baseline check. The 2 new test files added in this plan pass cleanly (8/8 tests).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Sync indicator UX is now complete: last-sync time + Sync Now button + orange dot on failures
- Cold-start protection prevents accidental selling with empty product cache
- Ready for remaining Phase 3 plans (battery optimization POS-06, low-stock warnings POS-07, etc.)

---
*Phase: 03-mobile-pos-optimization*
*Completed: 2026-03-18*
