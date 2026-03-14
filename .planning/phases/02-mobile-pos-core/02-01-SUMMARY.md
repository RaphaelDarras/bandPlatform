---
phase: 02-mobile-pos-core
plan: 01
subsystem: api
tags: [jwt, bcrypt, mongoose, mongodb-memory-server, concert, sale, pin-auth]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: JWT middleware (authenticateToken), Admin model with bcrypt, Sale model base, Concert model

provides:
  - POST /api/auth/pin-setup - authenticated PIN setup with bcrypt hashing
  - POST /api/auth/pin-login - PIN-based JWT login returning 24h token
  - GET /api/concerts - list concerts sorted by date desc
  - POST /api/concerts - create concert with city-to-location mapping
  - GET /api/concerts/:id - single concert fetch
  - PATCH /api/concerts/:id - field-whitelisted concert updates
  - Sale model with etransfer/paypal, currency, discount, discountType, voidedAt, voidedBy, idempotencyKey
  - Admin model with pinHash field

affects:
  - 02-mobile-pos-core
  - 03-batch-sync
  - mobile app auth flow

# Tech tracking
tech-stack:
  added: [mongodb-memory-server (devDependency, for integration model tests)]
  patterns:
    - TDD with mongodb-memory-server for Mongoose model integration tests
    - Sparse unique index for optional deduplication keys (idempotencyKey)
    - PIN hashing in route handler (not in model pre-save hook)
    - city request field maps to location database field

key-files:
  created:
    - api/routes/concerts.js
    - api/tests/pin-auth.test.js
    - api/tests/concerts.test.js
    - api/tests/models.test.js
  modified:
    - api/models/Sale.js
    - api/models/Admin.js
    - api/routes/auth.js
    - api/index.js
    - api/package.json

key-decisions:
  - "pinHash is stored verbatim in Admin model — PIN hashing is done in the route handler to avoid double-hashing risk"
  - "Sparse unique index on idempotencyKey allows many null/absent values but enforces uniqueness when set"
  - "city in POST /api/concerts body maps to location field to match mobile app terminology"
  - "PIN login finds admin with Admin.findOne({ active: true }) — assumes single admin for mobile POS"
  - "mongodb-memory-server used for model integration tests to verify schema behavior including index enforcement"

patterns-established:
  - "Pattern: Use sparse unique index for optional deduplication fields (allows null, rejects duplicate non-null values)"
  - "Pattern: Route handler does hashing for optional auth fields (not model pre-save hook) to maintain explicit control"

requirements-completed: [AUTH-01, POS-05]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 02 Plan 01: PIN Auth and Concert CRUD Summary

**PIN-based mobile login (bcrypt hash, 24h JWT), Concert CRUD endpoints, Sale model extended with etransfer/paypal/currency/discount/void/idempotencyKey fields**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T13:10:51Z
- **Completed:** 2026-03-14T13:15:54Z
- **Tasks:** 2 (each with TDD RED + GREEN cycles)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- Extended Sale model with 7 new fields for mobile POS: etransfer/paypal payment methods, currency (default EUR), discount/discountType, voidedAt/voidedBy, idempotencyKey with sparse unique index
- Added pinHash field to Admin model (verbatim storage, route handler does bcrypt hashing)
- Implemented POST /api/auth/pin-setup and POST /api/auth/pin-login endpoints with full validation
- Created Concert CRUD routes (GET list, POST create, GET detail, PATCH update) with explicit field whitelisting
- 95 tests passing across 9 suites (25 new tests, all existing Phase 1 tests still pass)

## Task Commits

Each task was committed atomically (TDD = 2 commits per task):

1. **Task 1 RED: Sale/Admin model failing tests** - `0e64bea` (test)
2. **Task 1 GREEN: Sale/Admin model implementation** - `a7853a5` (feat)
3. **Task 2 RED: PIN auth and Concert CRUD failing tests** - `272495f` (test)
4. **Task 2 GREEN: PIN auth and Concert CRUD implementation** - `576a438` (feat)

**Plan metadata:** _(docs commit — see below)_

_Note: TDD tasks have 2 commits each (test → feat)_

## Files Created/Modified

- `api/models/Sale.js` - Extended with etransfer/paypal, currency, discount, discountType, voidedAt, voidedBy, idempotencyKey (sparse unique index)
- `api/models/Admin.js` - Added pinHash string field (optional)
- `api/routes/auth.js` - Added POST /pin-setup and POST /pin-login endpoints
- `api/routes/concerts.js` - New file: Concert CRUD (GET list, POST create, GET detail, PATCH update)
- `api/index.js` - Registered /api/concerts route
- `api/tests/models.test.js` - New integration tests using mongodb-memory-server for Sale/Admin model validation
- `api/tests/pin-auth.test.js` - New unit tests for PIN setup and login endpoints
- `api/tests/concerts.test.js` - New unit tests for Concert CRUD endpoints
- `api/package.json` - Added mongodb-memory-server devDependency

## Decisions Made

- **PIN hashing in route handler:** The Admin model stores pinHash verbatim. The route handler calls bcrypt explicitly. This avoids the pre-save hook double-hashing problem (password already goes through the hook — PIN is optional and set separately).
- **Sparse unique index on idempotencyKey:** Sparse index allows multiple sales with no idempotencyKey (null values don't trigger uniqueness constraint) while still enforcing uniqueness for any key that is set.
- **city-to-location mapping:** POST /api/concerts accepts `city` and stores it as `location` to match mobile app field naming while keeping the DB schema consistent with existing Concert model.
- **PIN login single admin assumption:** `Admin.findOne({ active: true })` — suitable for a band's mobile POS with one active admin account.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed mongodb-memory-server**
- **Found during:** Task 1 (TDD RED - writing model integration tests)
- **Issue:** TDD tests for Mongoose model behavior (including index enforcement) require a real MongoDB connection. mongodb-memory-server not yet in project.
- **Fix:** `npm install --save-dev mongodb-memory-server`
- **Files modified:** api/package.json, api/package-lock.json
- **Verification:** All model tests pass using in-memory DB
- **Committed in:** `0e64bea` (Task 1 test commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking dependency)
**Impact on plan:** Required to enable integration-level model tests per TDD approach. No scope creep.

## Issues Encountered

None beyond the blocking dependency install above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PIN auth flow is operational: mobile app can call `/api/auth/pin-setup` (once) and then use `/api/auth/pin-login` for subsequent logins
- Concert CRUD is ready for mobile app to create/manage concerts
- Sale model is ready for batch sync fields (idempotencyKey, currency, discount)
- All Phase 1 endpoints remain functional (95 tests passing)

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
