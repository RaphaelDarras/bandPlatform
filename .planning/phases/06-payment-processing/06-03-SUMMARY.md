---
phase: 06-payment-processing
plan: 03
subsystem: payments
tags: [stripe, paypal, currency-conversion, webhooks, checkout-session, orders-v2]

# Dependency graph
requires:
  - phase: 06-payment-processing
    provides: "06-01 confirmed PayPal CJS require() access path (Client/OrdersController/Environment/CheckoutPaymentIntent, no .default); 06-02 Order model shippingAddress + orderNumber generation + live shared types"
provides:
  - "api/services/amounts.js — toStripeMinorUnits (integer cents) + toPaypalAmountString (decimal string), the two currency-unit conventions that must never be swapped"
  - "api/services/stripeClient.js — createCheckoutSession(order) (hosted Checkout Session, server-computed line_items) + verifyStripeEvent(rawBody, sig) (webhook signature verification)"
  - "api/services/paypalClient.js — createPaypalOrder(order) + capturePaypalOrder(id) (Orders v2, explicit capture) + verifyPaypalWebhook(headers, rawBodyString) (REST verify-webhook-signature)"
affects: [06-04, 06-05, 06-06, 06-07, 06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two distinctly-named currency helpers in one file (toStripeMinorUnits/toPaypalAmountString) so Stripe integer-cents and PayPal decimal-string conventions can never be silently swapped"
    - "Provider SDK singletons instantiated once at module load (stripe(...), new Client({...})) and re-exported as plain async functions — routes never touch the SDK objects directly"
    - "PayPal webhook verification uses PayPal's own /v1/notifications/verify-webhook-signature REST endpoint (OAuth client-credentials token via global fetch) rather than local CRC32/RSA self-verification — no dedicated WebhooksController exists in @paypal/paypal-server-sdk@2.4.0's export surface"

key-files:
  created:
    - api/services/amounts.js
    - api/services/amounts.test.js
    - api/services/stripeClient.js
    - api/services/paypalClient.js
  modified: []

key-decisions:
  - "createCheckoutSession(order) reads item.name for Stripe's product_data.name, per the plan's literal spec — the current OrderItemSchema (06-02) has no persisted name field, so the caller (Plan 05's orders route) is responsible for attaching a name onto each item object it passes in, without necessarily persisting it on the Order document. Documented here so Plan 05 does not silently drop this field."
  - "verifyPaypalWebhook hand-rolls an OAuth client-credentials token fetch (POST /v1/oauth2/token with Basic auth) using Node's built-in global fetch (Node 24 runtime, already used elsewhere) — @paypal/paypal-server-sdk@2.4.0 exports no WebhooksController, so the SDK cannot perform this REST call for us."
  - "PAYPAL_API_BASE selects https://api-m.sandbox.paypal.com vs https://api-m.paypal.com from PAYPAL_ENV, mirroring the existing Environment.Sandbox/Production selection already used for the OrdersController client."

patterns-established:
  - "Amount-unit helpers live in one file with maximally distinct names (never inline `* 100` or `.toFixed(2)` scattered across route/service files) — Plan 05's orders.js and any future provider-facing code must import from api/services/amounts.js, never hand-roll the conversion."
  - "Provider client files (stripeClient.js, paypalClient.js) only talk to their provider — no stock deduction, no email, no Order-model writes. Side effects belonging to D-07/D-09/D-14 live exclusively in the Plan 06 webhook handler."

requirements-completed: [SHOP-04, SHOP-05]

# Metrics
duration: 12min
completed: 2026-07-06
---

# Phase 6 Plan 3: Provider Currency Helpers + Stripe/PayPal Service Clients Summary

**Built the amount-unit conversion helpers (Stripe integer cents vs PayPal decimal strings) and the two provider-SDK service singletons — stripeClient.createCheckoutSession/verifyStripeEvent and paypalClient.createPaypalOrder/capturePaypalOrder/verifyPaypalWebhook — that the upcoming orders and webhooks routes will build on.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-06T21:49:46Z
- **Completed:** 2026-07-06T21:55:18Z
- **Tasks:** 3 (all executed, no checkpoints)
- **Files modified:** 4 (all created: amounts.js, amounts.test.js, stripeClient.js, paypalClient.js)

## Accomplishments
- `toStripeMinorUnits`/`toPaypalAmountString` implemented and unit-tested, including the `19.1 * 100 = 1909.9999999999998` float-drift edge case, guarding against the 100x mischarge risk called out in RESEARCH Pitfall 2 / threat T-06-08
- `stripeClient.js` builds a hosted Checkout Session with server-computed `line_items`, sets both `client_reference_id` and `metadata.orderNumber` to the order's correlation id, and exposes `verifyStripeEvent` wrapping `stripe.webhooks.constructEvent` (never a hand-rolled signature comparison)
- `paypalClient.js` uses the confirmed CJS `require('@paypal/paypal-server-sdk')` access path from 06-01 with no `.default` indirection, sends `amount.value` as a decimal string via `toPaypalAmountString` (never Stripe's integer helper — verified by grep), implements the explicit PayPal capture step (RESEARCH Pitfall 4), and verifies webhooks via PayPal's own REST verification endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Currency-unit helpers (Stripe cents vs PayPal decimal string)** - `e9b09a2` (test)
2. **Task 2: Stripe client — hosted Checkout Session + signature verification** - `f4897b6` (feat)
3. **Task 3: PayPal client — Orders v2 create/capture + webhook verification** - `79f33cd` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `api/services/amounts.js` - `toStripeMinorUnits(eur)` (Math.round(eur*100), integer) + `toPaypalAmountString(eur)` (eur.toFixed(2), string)
- `api/services/amounts.test.js` - Covers 19.99/19.1 conversions for both helpers, the float-rounding edge, and integer-vs-string type assertions
- `api/services/stripeClient.js` - `createCheckoutSession(order)` (mode payment, card only, EUR line_items via `toStripeMinorUnits`, success/cancel URLs) + `verifyStripeEvent(rawBody, signatureHeader)` (constructEvent wrapper)
- `api/services/paypalClient.js` - `createPaypalOrder(order)` (Orders v2 CAPTURE intent, decimal-string amount, PAY_NOW experience context) + `capturePaypalOrder(id)` (explicit capture) + `verifyPaypalWebhook(headers, rawBodyString)` (OAuth token + REST verify-webhook-signature call)

## Decisions Made
- `createCheckoutSession` expects `order.items[].name` for Stripe's `product_data.name`, matching the plan's literal spec, even though the persisted `OrderItemSchema` (from 06-02) has no `name` field today — this is an interface contract for Plan 05's orders route to satisfy when it assembles the items array passed into this function (documented in frontmatter `key-decisions` so it is not silently dropped).
- `verifyPaypalWebhook` fetches its own OAuth client-credentials token (`POST /v1/oauth2/token`) via Node's global `fetch`, because `@paypal/paypal-server-sdk@2.4.0`'s export surface (confirmed via `Object.keys(require('@paypal/paypal-server-sdk'))`) has no `WebhooksController` — this REST call could not be delegated to the SDK.
- Chose PayPal's `/v1/notifications/verify-webhook-signature` REST endpoint over local CRC32/RSA self-verification, per RESEARCH's explicit recommendation for a DIY/spare-time project (simpler, far less error-prone to get right).

## Deviations from Plan

None — plan executed exactly as written. Verification commands in the plan used the deprecated Jest 30 CLI flag `--testPathPattern` (singular, removed in Jest 30 in favor of `--testPathPatterns`); this was already fixed at the `npm test` script level in `api/package.json` during Plan 06-01, so running the corrected `npm test --workspace=api -- --testPathPatterns=amounts` (plural) form, as 06-02 also did, produced the expected green result for `amounts.test.js` plus the same 4 known pre-existing failures (out of scope, tracked in `deferred-items.md`). No new deviation — same pre-existing CLI-flag situation 06-01/06-02 already navigated, not re-logged as a new fix since no code changed for it in this plan.

## Issues Encountered

None beyond the known, already-tracked, out-of-scope pre-existing test failures (`concerts.test.js`, `products-put.test.js`, `inventory.test.js`, `models.test.js` — Concert schema migration requiring `city`/`country`). Verified this plan introduces zero new failures: baseline was 4 failed / 8 passed suites (110 passing tests) before this plan; after adding `amounts.test.js`, it is 4 failed / 9 passed suites (118 passing tests) — exactly +1 suite / +8 tests, matching `amounts.test.js`'s own test count.

## User Setup Required

None new for this plan. The `user_setup` block in this plan's frontmatter (Stripe test-mode secret key, PayPal sandbox client id/secret) describes account-level setup already scaffolded as env-var placeholders in `api/.env.example` during Plan 06-01; no code in this plan requires real credentials to import or unit-test (verified via `node -e` with dummy env values, matching the plan's own verification commands).

## Next Phase Readiness
- `amounts.js`, `stripeClient.js`, and `paypalClient.js` are ready for Plan 05 (`POST /api/orders`) to call `createCheckoutSession`/`createPaypalOrder` after building a pending Order, and for the later webhooks plan to call `verifyStripeEvent`/`verifyPaypalWebhook`.
- Plan 05 must attach a `name` field to each item object it passes into `createCheckoutSession(order)` (see Decisions Made) — the current `OrderItemSchema` does not persist one.
- PayPal `capturePaypalOrder` is ready for the `PaypalReturn.tsx` page's capture-on-return call (a small server route Plan 05 or a later plan must expose).
- Real Stripe/PayPal sandbox credentials still need to be placed in `api/.env` (not `.env.example`) before any of this plan's functions can be exercised end-to-end against live sandboxes.

---
*Phase: 06-payment-processing*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: api/services/amounts.js
- FOUND: api/services/amounts.test.js
- FOUND: api/services/stripeClient.js
- FOUND: api/services/paypalClient.js
- FOUND commit e9b09a2 (Task 1: test)
- FOUND commit f4897b6 (Task 2: feat)
- FOUND commit 79f33cd (Task 3: feat)
