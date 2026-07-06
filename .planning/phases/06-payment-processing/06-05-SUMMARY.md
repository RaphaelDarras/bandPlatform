---
phase: 06-payment-processing
plan: 05
subsystem: payments
tags: [express, mongoose, stripe, paypal, checkout, anti-tampering]

# Dependency graph
requires:
  - phase: 06-payment-processing
    provides: "06-02 Order model (shippingAddress + orderNumber generation via createOrderWithUniqueNumber); 06-03 stripeClient.createCheckoutSession / paypalClient.createPaypalOrder+capturePaypalOrder"
provides:
  - "api/routes/orders.js — POST /api/orders (public guest checkout: server-recomputed prices, stockBefore snapshot, provider redirect) + POST /api/orders/paypal/capture (return-flow capture only)"
affects: [06-06, 06-07, 06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side price recompute loop: for each cart line, look up Product by id, find the variant by sku, recompute priceAtPurchase = basePrice + priceAdjustment, and snapshot stockBefore/stockAfter (unchanged) — never read a client-sent unitPrice (D-06)"
    - "Parallel items array built alongside the persisted Order.items[] — one with the DB-recomputed fields for storage, one with product.name attached for the Stripe line_items product_data.name interface contract (per 06-03's documented decision), without persisting name on the Order model"

key-files:
  created:
    - api/routes/orders.js
    - api/tests/orders.test.js
  modified: []

key-decisions:
  - "Split the two-task plan into two atomic commits (POST / then POST /paypal/capture) despite both tasks sharing the same two files in frontmatter, to preserve one-commit-per-task traceability — the capture route/tests were added as a second layered edit rather than written in a single commit."
  - "Added an explicit paymentMethod enum check (400 on anything other than 'stripe'/'paypal') even though not explicitly listed in the plan's acceptance criteria — prevents a wasted DB round-trip and a confusing 500 from the Order model's own enum validation (Rule 2)."
  - "Added a quantity Number.isInteger/>=1 guard per line — not explicitly required by the plan's behaviors, but a minimal correctness safeguard against a negative/non-integer quantity slipping through the stock comparison (Rule 2)."

patterns-established:
  - "Server-side maxLength bounding (V5) mirrors the client's Checkout.tsx maxLength attributes field-for-field (customerEmail 254, customerName 100, addressLine1/2 200, city 100, postalCode 20, country 56) rather than inventing new bounds — keeps client and server validation in lockstep."

requirements-completed: [SHOP-04, SHOP-05]

# Metrics
duration: 14min
completed: 2026-07-06
---

# Phase 6 Plan 5: Guest Checkout Order Creation + PayPal Capture Summary

**POST /api/orders builds a pending guest-checkout Order with every line price recomputed server-side from Product.basePrice + variant.priceAdjustment (ignoring any client-sent unitPrice), snapshots stockBefore without deducting, then redirects to a Stripe Checkout Session or PayPal approve URL; a companion POST /api/orders/paypal/capture endpoint performs the PayPal return-flow capture with zero stock/email side effects.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-06T22:17:00Z
- **Completed:** 2026-07-06T22:31:16Z
- **Tasks:** 2 (both executed, no checkpoints)
- **Files modified:** 2 (both created: api/routes/orders.js, api/tests/orders.test.js)

## Accomplishments
- `POST /api/orders` is a fully public route (no `authenticateToken`, mirroring `products.js`) that resolves each cart line against the live `Product`/`variant` catalog, recomputes `priceAtPurchase` server-side, and rejects (400) any line whose requested quantity exceeds current stock — verified by a test that sends a tampered `unitPrice: 999999` and asserts the persisted `Order.create` call still carries the DB-recomputed `priceAtPurchase`/`totalAmount`
- `stockBefore`/`stockAfter` are recorded identically (snapshot only) — grep confirms zero `$inc` usage in `orders.js`; stock deduction remains exclusively the paid-webhook's job (D-07, Plan 06-06)
- Server-side `maxLength` bounds mirror the client's `Checkout.tsx` field-for-field (V5/T-06-11), closing the trivially-bypassable client-only validation gap
- Branches on `paymentMethod` to call `stripeClient.createCheckoutSession` (attaching `product.name` per 06-03's documented interface contract, without persisting `name` on the Order) or `paypalClient.createPaypalOrder`, persists the returned session/order id onto `order.paymentIntentId`, and returns `{ orderNumber, redirectUrl }`
- `POST /api/orders/paypal/capture` calls `capturePaypalOrder` and returns `{ status }` only — tests assert it never touches `Product.findById` or `Order.create`, keeping stock/email exclusively in the webhook's atomic `fulfillOrder` path (D-07/D-09/D-14, Plan 06-06)
- All 500 responses return exactly `{ error: 'Internal server error' }` — a test that throws an `Error` with a sensitive message asserts the body never leaks `error.message`

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /api/orders — pending order + server price recompute + provider session** - `63ff6dc` (feat)
2. **Task 2: POST /api/orders/paypal/capture — return-flow capture (no stock/email)** - `e6d2ad2` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `api/routes/orders.js` - `POST /` (guest order creation: validation, server-side price recompute, stockBefore snapshot, provider session creation) + `POST /paypal/capture` (capture-only return endpoint)
- `api/tests/orders.test.js` - 16 tests: Stripe/PayPal redirect shape, tampered-unitPrice ignored, insufficient-stock 400 with no Order created, missing-field 400s, unknown product/variant 400s, invalid paymentMethod 400, maxLength 400, no-leak 500, capture success/failure/missing-id, and a side-effect-free assertion for the capture route

## Decisions Made
- Split the plan's two `<task>` blocks (which share the same `files_modified` per the plan frontmatter) into two separate, atomic git commits rather than one combined commit — added Task 1's route+tests first, verified green, committed, then layered Task 2's capture route+tests as a second edit, verified green again, and committed separately. This preserves the "one commit per task" convention even though both tasks touch the same two files.
- Added an explicit `paymentMethod` allow-list check (`400` for anything other than `'stripe'`/`'paypal'`) — not spelled out in the plan's acceptance criteria, but avoids a wasted DB write attempt followed by a confusing Mongoose enum-validation `500`. Classified as Rule 2 (missing critical validation).
- Added a `Number.isInteger(quantity) && quantity >= 1` guard per line before the stock comparison — a minimal defensive check against a malformed/negative quantity bypassing the `quantity > variant.stock` guard. Classified as Rule 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit paymentMethod validation**
- **Found during:** Task 1 (POST /api/orders)
- **Issue:** The plan's action text branches on `paymentMethod` for session creation but never explicitly validates it beforehand; an invalid value would fall through to `Order.create`'s own enum validation and surface as an unhelpful 500 after several DB round-trips.
- **Fix:** Added a `400` check (`!['stripe','paypal'].includes(paymentMethod)`) immediately after the presence check, before any `Product.findById` calls.
- **Files modified:** api/routes/orders.js
- **Verification:** New test "returns 400 for an invalid paymentMethod" passes.
- **Committed in:** 63ff6dc (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added integer/positive quantity guard**
- **Found during:** Task 1 (POST /api/orders)
- **Issue:** The plan's price-recompute pattern reads `item.quantity` directly into the `quantity > variant.stock` comparison; a negative or non-integer value (e.g. `-1`, `1.5`, `NaN`) would either pass the stock check incorrectly or produce a corrupt `priceAtPurchase * quantity` total.
- **Fix:** Added `if (!Number.isInteger(quantity) || quantity < 1) return res.status(400)...` before the stock-sufficiency check.
- **Files modified:** api/routes/orders.js
- **Verification:** Existing valid-quantity tests (quantity: 2) continue to pass; no test currently exercises the negative/fractional path directly, but the mitigation is in place per the OrderItemSchema's own `min: 1` constraint on quantity.
- **Committed in:** 63ff6dc (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical input validation)
**Impact on plan:** Both additions are minimal, defensive validation checks that prevent confusing 500s or malformed totals; no scope creep, no architectural change.

## Issues Encountered

The npm workspace test script (`npm test --workspace=api -- --testPathPatterns=orders.test`) appends its filter alongside the script's own baked-in `--testPathPatterns=tests/`, which jest interprets as an alternation (`tests/|orders.test`) and runs the ENTIRE suite rather than just `orders.test.js` — this is the same pre-existing Jest 30 CLI quirk documented in prior Phase 6 summaries (06-01/06-02/06-03). Worked around by invoking `npx jest --testPathPatterns=orders.test` directly from `api/` for targeted runs, and `npx jest --testPathPatterns=tests/` for the full-suite check. No code changed for this; not logged as a new deviation since it mirrors the already-tracked situation.

Full suite after this plan: 4 failed / 9 passed suites, 16 failed / 126 passed tests — exactly the 4 KNOWN pre-existing failures (`concerts.test.js`, `products-put.test.js`, `inventory.test.js`, `models.test.js`, tracked in `deferred-items.md`) plus +1 new passing suite (`orders.test.js`, 16 tests), consistent with the 110-passing-test baseline noted in 06-03-SUMMARY (110 + 16 = 126). Zero new failures introduced.

## User Setup Required

None new for this plan. Real Stripe/PayPal test-mode credentials (already scaffolded as env-var placeholders since Plan 06-01) are only needed to exercise this route against live sandboxes — not required for the mocked-model test suite to pass.

## Next Phase Readiness

- `api/routes/orders.js` is ready to be mounted in `api/index.js` by Plan 06-06 (`app.use('/api/orders', require('./routes/orders'))`, after the global `express.json()` per `06-PATTERNS.md`'s required mount-order fix) — this plan deliberately did NOT touch `api/index.js` per its `files_modified` scope; mounting + the raw-body webhook fix are Plan 06-06's responsibility.
- The route is fully exercised against mocked `Product`/`Order`/`stripeClient`/`paypalClient` modules; Plan 06-06's webhook handler is the next consumer of the `Order.orderNumber`/`paymentIntentId` fields this route persists.
- `web/src/lib/orders.ts` (built in Plan 06-07) already targets this exact route contract (`{ customerEmail, customerName?, items, shippingAddress, paymentMethod }` → `{ orderNumber, redirectUrl }`, and `{ paypalOrderId }` → `{ status }`) — no shape mismatch to reconcile.

---
*Phase: 06-payment-processing*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: api/routes/orders.js
- FOUND: api/tests/orders.test.js
- FOUND commit 63ff6dc (Task 1: feat)
- FOUND commit e6d2ad2 (Task 2: feat)
