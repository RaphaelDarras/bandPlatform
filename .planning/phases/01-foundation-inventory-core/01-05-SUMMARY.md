---
phase: 01-foundation-inventory-core
plan: 05
subsystem: api
tags: [express, mongoose, mongodb, inventory, products, tdd, jest, supertest]

# Dependency graph
requires:
  - phase: 01-foundation-inventory-core
    provides: Product model with embedded variants (sku, stock, version, size, color, priceAdjustment)
  - phase: 01-foundation-inventory-core
    provides: Inventory endpoints (reserve, release, deduct, restock) managing stock/version
provides:
  - PUT /api/products/:id with explicit field whitelisting (allowedProductFields + allowedVariantFields)
  - Safe variant metadata updates via positional $set matched by SKU
  - Protection of stock and version fields against accidental overwrite
  - 6-test TDD suite covering all safe-update scenarios
affects: [any future product catalog admin UI, e-commerce integrations, any client calling PUT /api/products]

# Tech tracking
tech-stack:
  added: [jest, supertest]
  patterns:
    - Explicit $set construction from whitelisted field arrays (never pass req.body to Mongoose)
    - Per-variant positional operator ($) updates matched by SKU
    - TDD RED-GREEN for API route behavior with jest mocks

key-files:
  created:
    - api/tests/products-put.test.js
  modified:
    - api/routes/products.js
    - api/package.json

key-decisions:
  - "Use allowedProductFields and allowedVariantFields arrays to build explicit $set — prevents any future field from slipping through untested"
  - "Fetch final product with findById after updates (not findByIdAndUpdate return) to guarantee consistent post-update snapshot"
  - "Return 400 for body with no recognized fields rather than silently accepting a no-op"

patterns-established:
  - "Whitelist pattern: iterate allowedFields array, copy only known keys into $set — apply to all future update endpoints"
  - "Variant positional update: Product.updateOne({ _id, 'variants.sku': sku }, { $set: { 'variants.$.field': value } })"

requirements-completed: [INV-01, INV-02, INV-03, INV-04, AUTH-02]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 1 Plan 05: Safe PUT Product Endpoint Summary

**PUT /api/products/:id rewritten with explicit field whitelisting — allowedProductFields + per-SKU variant $set ensures stock and version are never overwritten via product catalog updates.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T21:44:51Z
- **Completed:** 2026-03-12T21:46:51Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Eliminated inventory data corruption risk: PUT body can no longer replace embedded variant documents
- Defined `allowedProductFields` and `allowedVariantFields` constants as the authoritative whitelist
- Variant updates via positional `$` operator match by SKU — no new variants created, no stock/version touched
- 6-test TDD suite (jest + supertest with mongoose mocks) covering all specified behaviors including unknown-field rejection
- Swagger JSDoc updated documenting protected fields and variant matching contract

## Task Commits

1. **TDD RED - Failing tests** - `abf9431` (test)
2. **TDD GREEN - Implementation** - `c2304b4` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified
- `api/routes/products.js` - PUT handler rewritten with explicit $set whitelisting and Swagger docs updated
- `api/tests/products-put.test.js` - 6 TDD tests covering all safe-update scenarios
- `api/package.json` - Added jest and supertest dev dependencies, test script configured

## Decisions Made
- Used `allowedProductFields` and `allowedVariantFields` arrays to whitelist explicitly — makes the contract clear and auditable at a glance
- Fetched final product with `findById` after all updates to return a consistent post-update snapshot
- Returning 400 for unrecognized/empty body prevents silent no-ops that could mislead callers

## Deviations from Plan

None - plan executed exactly as written. TDD infrastructure (jest + supertest) was set up as the first action per TDD execution flow.

## Issues Encountered

None. The mock-based TDD approach (mocking mongoose and jsonwebtoken) allowed full route testing without a real database connection.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Product catalog CRUD is now fully safe: POST creates, GET reads, PUT safely updates, DELETE soft-deletes
- Inventory endpoints (reserve, release, deduct, restock) can operate concurrently with product catalog updates without risk of data corruption
- Ready to proceed to Phase 2 (concert sales tool)

## Self-Check: PASSED

- FOUND: api/tests/products-put.test.js
- FOUND: api/routes/products.js
- FOUND: 01-05-SUMMARY.md
- FOUND: commit abf9431 (test RED)
- FOUND: commit c2304b4 (feat GREEN)

---
*Phase: 01-foundation-inventory-core*
*Completed: 2026-03-12*
