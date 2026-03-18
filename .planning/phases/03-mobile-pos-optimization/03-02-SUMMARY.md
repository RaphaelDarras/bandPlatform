---
phase: 03-mobile-pos-optimization
plan: 02
subsystem: ui
tags: [react-native, sqlite, concert-reports, sales-analytics]

# Dependency graph
requires:
  - phase: 02-mobile-pos-core
    provides: getLocalSales(), LocalSaleRow interface, SQLite sales table with items_json and voided columns

provides:
  - getConcertReport() async function with ConcertReport type
  - VariantSaleBreakdown and PaymentMethodBreakdown interfaces
  - Concert detail screen Product Breakdown card
  - Concert detail screen Payment Methods card with voided footer

affects: [concert-detail, sales-analytics, history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone async function pattern for testability — getConcertReport() is exported outside the hook so tests can mock deps without rendering"
    - "Payment method normalisation via .toLowerCase() + display label map"
    - "Group-by pattern using Map<key, accumulator> for variant and payment aggregation"

key-files:
  created:
    - mobile/src/__tests__/features/concerts/concertReport.test.ts
  modified:
    - mobile/src/features/concerts/useConcerts.ts
    - mobile/src/app/concerts/[id].tsx

key-decisions:
  - "getConcertReport is a standalone exported function (not hook-only) — enables unit testing without renderHook overhead"
  - "Payment breakdowns grouped by (method.toLowerCase(), currency) pair — same method in different currencies are separate entries"
  - "variantBreakdowns keyed by (productId, variantSku, currency) — same variant sold in different currencies tracked separately"
  - "closeConcert() still returns ConcertTotals; concert detail calls getConcertReport() separately after close to get full report"

patterns-established:
  - "Concert report aggregation: nonVoided = allSales.filter(!s.voided), voided = allSales.filter(s.voided)"
  - "total_amount access: (s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount pattern"

requirements-completed: [POS-08]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 03 Plan 02: Concert Sales Reports Summary

**getConcertReport() with variant/payment breakdowns rendered inline on concert detail screen, voided sales excluded from totals and noted separately**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T20:45:47Z
- **Completed:** 2026-03-18T20:50:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- getConcertReport() aggregates variant sales from items_json, groups payments by (method, currency), and separates voided sales
- Concert detail screen now shows Product Breakdown card (variants grouped by product, sorted by quantity sold) and Payment Methods card (sorted by revenue)
- 10 unit tests covering basic aggregation, voided exclusion, empty input, multi-currency, payment method normalisation

## Task Commits

Each task was committed atomically:

1. **Task 1: getConcertReport with types and tests** - `8d0338f` (feat + test, TDD)
2. **Task 2: Add sales report UI to concert detail screen** - `e4a89b6` (feat)

## Files Created/Modified

- `mobile/src/__tests__/features/concerts/concertReport.test.ts` - 10 unit tests for getConcertReport aggregation logic
- `mobile/src/features/concerts/useConcerts.ts` - Added VariantSaleBreakdown, PaymentMethodBreakdown, ConcertReport interfaces; getConcertReport standalone function; exposed via hook return
- `mobile/src/app/concerts/[id].tsx` - Updated to use getConcertReport instead of getConcertTotals; added Product Breakdown and Payment Methods cards; voided footer

## Decisions Made

- getConcertReport is a standalone exported function rather than hook-only, enabling unit test mocking of getDb, getLocalSales, getCachedProducts without renderHook
- Payment breakdowns keyed by (method.toLowerCase(), currency) — normalises 'Cash', 'CASH', 'cash' to the same group; different currencies remain separate entries
- closeConcert() still returns ConcertTotals (no API change); the concert detail screen calls getConcertReport() independently after close for full report data
- variantBreakdowns include currency field and are keyed per-currency — handles multi-currency concerts correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Test file needed additional jest.mock calls for `@/api/concerts` and `expo-crypto` — the useConcerts module imports these transitively. Added mocks at top of test file before imports. Not a deviation: standard Jest mock setup required for any test importing a module with transitive dependencies.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Concert detail screen now provides full sales analytics without requiring a network connection
- getConcertReport() is available for reuse in any future reporting screens (e.g., end-of-tour aggregate)
- No blockers for next plan

---
*Phase: 03-mobile-pos-optimization*
*Completed: 2026-03-18*
