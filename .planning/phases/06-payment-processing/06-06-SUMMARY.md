---
phase: 06-payment-processing
plan: 06
subsystem: payments
tags: [stripe, paypal, webhooks, resend, mongoose, idempotency, express]

# Dependency graph
requires:
  - phase: 06-payment-processing (02/03/04/05)
    provides: Order model with shippingAddress + paymentIntentId, stripeClient.verifyStripeEvent, paypalClient.verifyPaypalWebhook/capturePaypalOrder, email.js senders
provides:
  - Raw-body-before-json webhook mount fixing the AUTH-03 middleware-ordering landmine
  - api/routes/webhooks.js with a shared fulfillOrder() idempotent fulfillment path used by both providers
  - Signature-verified, idempotent pending->paid Order transition (atomic findOneAndUpdate as the sole idempotency gate)
  - Guarded, never-negative, never-rejecting online stock deduction distinct from sales.js (POS allow-negative) and inventory.js (409-reject)
  - Both Resend emails (customer confirmation + band notification with shortfall flag) fired from the webhook
  - GO-LIVE.md rollout checklist (D-19)
affects: [06.1-admin-panel, phase-7-fulfillment-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic status-transition as idempotency gate: Order.findOneAndUpdate({orderNumber,status:'pending'},{$set:{status:'paid',...}}) IS the dedupe mechanism, no processed-events collection needed"
    - "Guarded no-negative no-reject $inc: $elemMatch stock>=quantity guard (borrowed from inventory.js) with neither inventory.js's 409-reject nor sales.js's bare allow-negative $inc -- a third, online-specific stock-mutation shape"
    - "Raw-body webhook routes mounted before the global express.json() in api/index.js, with express.raw() scoped per-route inside webhooks.js"
    - "Shared fulfillOrder() helper reused verbatim by both provider handlers -- zero duplicated atomic-transition/stock/email logic"

key-files:
  created:
    - api/routes/webhooks.js
    - api/tests/webhooks-stripe.test.js
    - api/tests/webhooks-paypal.test.js
    - .planning/phases/06-payment-processing/GO-LIVE.md
  modified:
    - api/index.js

key-decisions:
  - "webhooks.js's stock-mutation shape is a hybrid unique to the online channel: inventory.js's $elemMatch floor-guard without its 409-reject/version-guard, and explicitly NOT sales.js's bare allow-negative $inc (D-08)"
  - "webhooks-paypal.test.js mocks stripeClient.js even though only the PayPal path is exercised, because webhooks.js requires both provider clients at module load and the real Stripe SDK throws synchronously without STRIPE_SECRET_KEY set"

patterns-established:
  - "fulfillOrder(orderNumber, paymentIntentId) is the single source of truth for pending->paid + stock + email; any future provider webhook must call it rather than reimplementing the atomic transition"

requirements-completed: [SHOP-04, SHOP-05, SHOP-06, AUTH-03]

duration: 5min
completed: 2026-07-06
---

# Phase 6 Plan 06: Webhook Fulfillment (Stripe + PayPal) + Go-Live Checklist Summary

**Raw-body-mounted, signature-verified Stripe and PayPal webhooks that atomically flip Order pending->paid exactly once, deduct online stock with a guarded never-negative never-rejecting `$inc`, and fire both Resend emails — the phase's security core (AUTH-03/D-07/D-08/D-09/D-10).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-06T22:51:32Z
- **Completed:** 2026-07-06T22:56:45Z
- **Tasks:** 3
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments

- Fixed the AUTH-03 middleware-ordering landmine: `api/index.js` now mounts `/api/webhooks` with `express.raw()` (scoped per-route inside `webhooks.js`) BEFORE the global `express.json()`, and mounts the previously-unwired `/api/orders` router after it.
- Implemented `api/routes/webhooks.js` with a single shared `fulfillOrder(orderNumber, paymentIntentId)` helper: the atomic `Order.findOneAndUpdate({orderNumber, status:'pending'}, {$set:{status:'paid',...}})` transition is itself the D-10 idempotency gate — a replayed/duplicate webhook delivery finds no `pending` document and safely no-ops.
- Per-line stock deduction is a guarded atomic `$inc` (`$elemMatch` `stock >= quantity`) that can never drive online stock negative (D-08) and never rejects the webhook (payment already captured) — a guard-miss leaves `stockAfter = stockBefore` and sets a `shortfall` flag surfaced in the band notification email for manual reconciliation.
- Both Stripe (`checkout.session.completed` + `payment_status === 'paid'`, correlated via `client_reference_id`) and PayPal (`PAYMENT.CAPTURE.COMPLETED`, correlated via `resource.custom_id`) handlers verify their provider's signature as the very first statement — on failure, zero DB access occurs and a 4xx is returned.
- 6 new integration tests (MongoMemoryServer, real atomic `findOneAndUpdate`) cover: invalid signature -> 400 + no mutation (both providers), happy-path fulfillment -> paid + stock decremented + 2 emails, idempotent replay -> no double-decrement/double-email, and the oversell/shortfall case -> stock stays unchanged and non-negative, webhook still acks 200, order still marked paid, band email flags the shortfall.
- `.planning/phases/06-payment-processing/GO-LIVE.md` documents the full test-mode/sandbox -> live rollout sequence (D-19), explicitly calling out that Stripe's CLI/test-Dashboard/live webhook secrets are three distinct values and that PayPal's `webhook_id` differs sandbox vs live.

## Task Commits

Each task was committed atomically:

1. **Task 1: Raw-body mount + webhooks skeleton + fulfillOrder + Stripe handler** - `7990bff` (feat)
2. **Task 2: PayPal webhook handler** - `784e0d6` (feat)
3. **Task 3: Go-live checklist (D-19)** - `aa98362` (docs)

**Plan metadata:** commit pending (this file + STATE/ROADMAP/REQUIREMENTS updates)

## Files Created/Modified

- `api/index.js` - Webhooks router mounted with raw body before `express.json()`; `/api/orders` mounted after it (was previously never wired into the app)
- `api/routes/webhooks.js` - Shared `fulfillOrder()` + `POST /stripe` + `POST /paypal` handlers
- `api/tests/webhooks-stripe.test.js` - 4 tests: invalid signature, happy path, idempotent replay, oversell shortfall
- `api/tests/webhooks-paypal.test.js` - 2 tests: invalid signature, happy path + idempotent replay
- `.planning/phases/06-payment-processing/GO-LIVE.md` - Test/sandbox -> live rollout checklist

## Decisions Made

- The online webhook's stock-mutation code is deliberately a third shape, distinct from both existing precedents: it borrows `inventory.js`'s `$elemMatch` floor-guard (never negative) but drops its 409-reject and `version` optimistic-lock field (payment is already captured, so the webhook must always ack 200); it does not use `sales.js`'s bare allow-negative `$inc` (that remains POS-only, D-08).
- `webhooks-paypal.test.js` mocks `../services/stripeClient` even though the suite only exercises the PayPal route, because `webhooks.js` requires both provider service modules at module load time and the real `stripe` SDK constructor throws synchronously when `STRIPE_SECRET_KEY` is unset — mirroring the existing `orders.test.js` convention of mocking both provider clients regardless of which path is under test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked stripeClient in webhooks-paypal.test.js**
- **Found during:** Task 2 (PayPal webhook test run)
- **Issue:** `webhooks.js` requires `../services/stripeClient` at module load (both handlers share one router file); the real module instantiates the Stripe SDK with `process.env.STRIPE_SECRET_KEY`, which is unset in the test environment, causing `new Stripe(undefined)` to throw `Neither apiKey nor config.authenticator provided` and fail every test in the suite before any assertion ran.
- **Fix:** Added `jest.mock('../services/stripeClient', () => ({ verifyStripeEvent: jest.fn() }))` to `webhooks-paypal.test.js`, mirroring the existing pattern in `orders.test.js` of mocking both provider clients unconditionally.
- **Files modified:** api/tests/webhooks-paypal.test.js
- **Verification:** `npx jest --testPathPatterns=webhooks-paypal` — both tests pass.
- **Committed in:** 784e0d6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to get the PayPal test suite running at all; no scope creep — the fix is test-infrastructure-only, no production code changed.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None for this plan's own execution — Stripe/PayPal/Resend env vars were already documented in `api/.env.example` by prior plans (06-01/06-03/06-04) and are assumed present in the deploy environment. See `GO-LIVE.md` for the test-mode -> live-mode credential swap the band must perform before accepting real payments.

## Self-Check: PASSED

- FOUND: api/index.js (modified, raw-body mount confirmed present)
- FOUND: api/routes/webhooks.js
- FOUND: api/tests/webhooks-stripe.test.js
- FOUND: api/tests/webhooks-paypal.test.js
- FOUND: .planning/phases/06-payment-processing/GO-LIVE.md
- FOUND: commit 7990bff
- FOUND: commit 784e0d6
- FOUND: commit aa98362

## Next Phase Readiness

- Phase 6 (Payment Processing) is now fully implemented: all 8 plans (06-01 through 06-08) complete. `npm test --workspace=api` full suite: 132 passed / 16 failed (the 16 failures are the 4 pre-existing Concert-schema-migration suites tracked in `deferred-items.md`, unrelated to this phase — unchanged before/after this plan's changes).
- Manual smoke test against Stripe test mode (test card `4242 4242 4242 4242`) and PayPal sandbox, per `GO-LIVE.md` section 5, remains the phase's manual-only gate before `/gsd:verify-work` sign-off (per `06-VALIDATION.md`).
- Phase 06.1 (Admin panel /orders view) can now build on real, webhook-populated Order records.

---
*Phase: 06-payment-processing*
*Completed: 2026-07-06*
