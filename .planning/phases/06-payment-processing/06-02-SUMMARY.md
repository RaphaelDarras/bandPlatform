---
phase: 06-payment-processing
plan: 02
subsystem: database
tags: [mongoose, crypto, typescript, order-model, shared-types]

# Dependency graph
requires:
  - phase: 06-payment-processing (plan 01)
    provides: stripe/@paypal/paypal-server-sdk/resend installed, PayPal SDK CJS interop confirmed
provides:
  - "Order model with required shippingAddress subdocument (D-04)"
  - "Order.toJSON() id transform (matches Product.js convention)"
  - "orderNumber.js service: generateOrderNumber() (crypto.randomBytes, HRK-prefixed) + createOrderWithUniqueNumber() retry-on-E11000 (D-11)"
  - "packages/shared live Order/OrderItem/ShippingAddress/CreateOrderResponse types (promoted from Phase-5 forward-compat placeholders)"
affects: [06-payment-processing (orders route, webhooks route, frontend checkout plans)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "orderNumber generation: crypto.randomBytes over a 33-char ambiguity-free alphabet, never Math.random"
    - "createOrderWithUniqueNumber(Model, data) generic retry-on-E11000 wrapper (up to 5 attempts, re-throws non-11000 errors immediately)"
    - "ShippingAddress sub-schema styled after OrderItemSchema ({ _id: false }, trim on every string field)"

key-files:
  created:
    - api/services/orderNumber.js
    - api/services/orderNumber.test.js
    - api/tests/order-model.test.js
  modified:
    - api/models/Order.js
    - packages/shared/src/index.ts

key-decisions:
  - "createOrderWithUniqueNumber signature is (Model, data) — generic over any Mongoose model, not hardcoded to Order — matching the plan's exact spec over RESEARCH.md's Order-specific sketch"
  - "Kept OrderItemSchema's existing min:0 on stockBefore/stockAfter untouched (intentional asymmetry with Sale.js per D-08 — online orders never go negative)"

patterns-established:
  - "Pattern: toJSON id transform (ret.id = ret._id.toString(); delete ret._id; delete ret.__v) now applied to both Product and Order — reusable shape for any future model needing client-facing id"

requirements-completed: [SHOP-04, SHOP-05]

# Metrics
duration: 16min
completed: 2026-07-06
---

# Phase 6 Plan 2: Order Data Foundation (shippingAddress, orderNumber, shared types) Summary

**Order model gains a required shippingAddress subdoc + id transform, orderNumber service generates crypto-random HRK-XXXXXX codes with E11000 collision retry, and packages/shared's Order/OrderItem types are promoted from Phase-5 forward-compat placeholders to their live Phase-6 shape.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-06T23:30:39+02:00
- **Completed:** 2026-07-06T23:46:32+02:00
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- `orderNumber.js` service: `generateOrderNumber()` produces `/^HRK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/` codes via `crypto.randomBytes` (never `Math.random`); `createOrderWithUniqueNumber(Model, data)` retries up to 5 times on Mongo's `E11000` duplicate-key error, re-throwing any other error immediately (D-11)
- `Order` model now requires a `shippingAddress` subdocument (addressLine1/addressLine2/city/postalCode/country, trimmed) and serializes with `id` instead of `_id`/`__v` via a `toJSON` transform copied from `Product.js` (D-04)
- `packages/shared/src/index.ts` `Order`/`OrderItem` interfaces promoted from "Phase-6 forward-compat, not persisted" placeholders to live types; added `ShippingAddress` and `CreateOrderResponse` interfaces for downstream orders-route and frontend-checkout plans

## Task Commits

Each task was committed atomically (Task 1 used the TDD RED/GREEN cycle):

1. **Task 1: orderNumber generation service (D-11)** — RED: `12bb0a7` (test), GREEN: `618cc6d` (feat)
2. **Task 2: Add shippingAddress subdoc + toJSON transform to Order model (D-04)** — `f35922b` (feat)
3. **Task 3: Promote shared Order/OrderItem types + add ShippingAddress & CreateOrderResponse** — `041be60` (feat)

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified
- `api/services/orderNumber.js` - `generateOrderNumber()` + `createOrderWithUniqueNumber(Model, data)`, crypto.randomBytes-backed
- `api/services/orderNumber.test.js` - format regex, ambiguous-character exclusion, 1000-call uniqueness, retry-on-11000, non-11000 immediate re-throw, 5-attempt exhaustion
- `api/models/Order.js` - added `ShippingAddressSchema`, required `shippingAddress` field, `toJSON` id transform
- `api/tests/order-model.test.js` - MongoMemoryServer tests: missing shippingAddress rejected, missing nested field rejected, valid save, `id` exposed via `toJSON()` and `JSON.stringify`
- `packages/shared/src/index.ts` - `ShippingAddress` + `CreateOrderResponse` interfaces added; `Order` extended with `shippingAddress`/`paymentMethod`; stale "not persisted this phase" comments removed from `Order`/`OrderItem`

## Decisions Made
- `createOrderWithUniqueNumber(Model, data)` kept generic over `Model` (per plan's exact task 1 spec) rather than hardcoded to `Order` (RESEARCH.md's sketch) — makes the helper reusable if another collection ever needs a similar unique-code pattern
- Did not touch `OrderItemSchema.stockBefore`/`stockAfter`'s existing `min: 0` — plan explicitly calls out this is load-bearing (D-08) and must not be "aligned" with `Sale.js`'s allow-negative fields

## Deviations from Plan

None — plan executed exactly as written. `api/models/Order.js` already had a pre-existing `OrderSchema.index({ orderNumber: 1 })` (non-unique, redundant with the field-level `unique: true`) which produces a harmless Mongoose duplicate-index warning during tests; this predates this plan's changes and was not introduced or modified by it (out of scope per SCOPE BOUNDARY — left untouched).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `api/services/orderNumber.js` and the extended `Order` model are ready for the `POST /api/orders` route (Plan 05) and the webhook handler (later plan) to build against
- `packages/shared`'s `ShippingAddress`/`Order`/`CreateOrderResponse` types are ready for `web/src/lib/orders.ts` and `Checkout.tsx` activation (later plan)
- Full `api` test suite verified green apart from the 4 pre-existing Concert-schema-migration failures tracked in `.planning/phases/06-payment-processing/deferred-items.md` (unrelated to this plan's files); full `web` test suite (22 suites, 114 tests) passes unaffected by the shared-type promotion
- No blockers for Plan 01 (parallel, already complete) or subsequent Phase 6 plans

---
*Phase: 06-payment-processing*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk; all task commit hashes (`12bb0a7`, `618cc6d`, `f35922b`, `041be60`, `c603c81`) verified present in `git log`.
