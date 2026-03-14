---
phase: 02-mobile-pos-core
plan: 02
subsystem: api
tags: [mongodb, mongoose, express, jest, idempotency, sales, pos]

# Dependency graph
requires:
  - phase: 02-mobile-pos-core plan 01
    provides: Sale model with idempotencyKey sparse unique index, Concert model, PIN auth
  - phase: 01-foundation
    provides: Product model with embedded variants, authenticateToken middleware

provides:
  - POST /api/sales/batch — batch sale submission with idempotency deduplication
  - GET /api/sales — sale listing with optional concertId filter
  - POST /api/sales/:id/void — void sale with stock reversal
  - POST /api/sales/:id/unvoid — unvoid sale with stock re-deduction
  - api/routes/sales.js — complete sales router

affects:
  - 02-mobile-pos-core plan 03
  - mobile app offline-first sync

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotency via sparse unique index — findOne check before insert, skip on match"
    - "Batch loop with per-item atomic stock deduction via $inc"
    - "stockBefore read via findOne pre-deduction, stockAfter from findOneAndUpdate result"
    - "Concert sales never rejected — stock can go negative by design"
    - "Void/unvoid symmetry — void adds back stock, unvoid deducts again"

key-files:
  created:
    - api/routes/sales.js
    - api/tests/sales-batch.test.js
  modified:
    - api/index.js

key-decisions:
  - "Process batch sales sequentially in a loop (not insertMany) — enables per-item idempotency check and stock reads"
  - "stockBefore captured via separate findOne before deduction — trade-off: not perfectly atomic with deduction but acceptable for concert POS"
  - "No stock floor validation on batch — stock goes negative rather than rejecting concert sales (per existing user decision)"

patterns-established:
  - "TDD RED-GREEN for route tests: write all failing tests first, then implement"
  - "Mock Sale, Product at module level; use jest.clearAllMocks() in beforeEach"

requirements-completed: [POS-01, POS-03]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 02 Plan 02: Sales API (Batch, List, Void/Unvoid) Summary

**Batch sale submission with idempotency key deduplication, atomic stock deduction, and void/unvoid endpoints with stock reversal using Express and Mongoose**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T13:18:23Z
- **Completed:** 2026-03-14T13:20:00Z
- **Tasks:** 2
- **Files modified:** 3 (created: 2, modified: 1)

## Accomplishments
- POST /api/sales/batch accepts array of sales, checks idempotencyKey before each insert, silently skips duplicates, returns `{ created, skipped, sales }`
- Atomic stock deduction per item via `$inc` on Product.variants.$.stock — concert sales never rejected (stock can go negative)
- GET /api/sales with optional `concertId` query filter, sorted by createdAt desc
- POST /api/sales/:id/void sets voidedAt/voidedBy and reverses stock; POST /api/sales/:id/unvoid clears void and re-deducts stock
- 19 integration tests covering happy paths, idempotency deduplication, negative stock, auth, 400/404 error cases

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests** - `0d7e58b` (test)
2. **Task 1 + Task 2: sales.js + index.js** - `4baf7e4` (feat)

_Note: TDD tasks — test commit precedes implementation commit. Both tasks implemented in single route file._

## Files Created/Modified
- `api/routes/sales.js` - Complete sales router: batch submit, list, void, unvoid
- `api/tests/sales-batch.test.js` - 19 integration tests for all 4 endpoints
- `api/index.js` - Registered `app.use('/api/sales', require('./routes/sales'))`

## Decisions Made
- Batch processes sales sequentially (not insertMany) to allow per-item idempotency check and stock reads before insert
- stockBefore captured via a separate `findOne` before deduction — not perfectly atomic with deduction, but acceptable for concert POS context
- No stock floor check — stock can go negative by design (concert sales never rejected, per existing user decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Sales batch API ready for mobile app offline sync integration
- Void/unvoid endpoints ready for history screen corrections
- All endpoints behind authenticateToken — mobile app must include Bearer token
- Ready for Phase 02-03 (receipt generation or next planned feature)

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
