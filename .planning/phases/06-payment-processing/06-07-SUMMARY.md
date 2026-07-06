---
phase: 06-payment-processing
plan: 07
subsystem: payments
tags: [react, zustand, fetch-client, checkout, stripe, paypal, eur]

# Dependency graph
requires:
  - phase: 06-payment-processing (plan 02)
    provides: "Order model with shippingAddress, packages/shared ShippingAddress/CreateOrderResponse types"
provides:
  - "web/src/lib/orders.ts runtime fetch client (createOrder, capturePaypalOrder)"
  - "Live Checkout.tsx submit path: cart+form -> createOrder -> redirect to hosted-provider URL"
  - "Stripe-card vs PayPal payment-method selector on /checkout (D-03)"
  - "All shop-facing prices display in EUR, not CAD (D-01)"
affects: [06-payment-processing (PaypalReturn.tsx / Plan 08 imports capturePaypalOrder), 06.1-admin-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "web/src/lib/orders.ts mirrors products.ts's runtime fetch-in-lib pattern (VITE_API_URL constant, res.ok throw, no Authorization header)"
    - "Checkout.tsx handleSubmit mirrors Stock.tsx's login() form-submit + fetch + catch-sets-inline-error pattern"

key-files:
  created:
    - web/src/lib/orders.ts
    - web/src/lib/orders.test.ts
  modified:
    - web/src/pages/Checkout.tsx
    - web/src/pages/Checkout.test.tsx
    - web/src/pages/Cart.tsx
    - web/src/pages/Cart.test.tsx
    - web/src/pages/ShopDetail.tsx
    - web/src/pages/ShopDetail.test.tsx
    - web/src/components/CatalogGrid.tsx
    - web/src/components/CatalogGrid.test.tsx
    - web/src/pages/Shop.test.tsx

key-decisions:
  - "allFieldsValid recomputed on every render from REQUIRED_FIELDS.every(validateField(...) === ''), not tracked as separate state — keeps Place Order's disabled state trivially correct without a duplicate source of truth"
  - "handleSubmit re-validates all required fields and marks them touched before calling createOrder — belt-and-braces guard even though the button is already disabled until allFieldsValid"
  - "customerName and shippingAddress.addressLine2 sent as undefined (not empty string) when blank, matching the optional-field convention on ShippingAddress/CreateOrderPayload types"
  - "Payment-method selector uses plain radio inputs wrapped in <label> (not a new component) — consistent with the rest of Checkout.tsx's hand-rolled controlled-input style, no new UI component introduced for two options"

patterns-established:
  - "Runtime-only fetch-in-lib client (orders.ts) reusing products.ts's exact VITE_API_URL/res.ok/throw convention for a second public endpoint"

requirements-completed: [SHOP-04, SHOP-05]

# Metrics
duration: 4min
completed: 2026-07-07
---

# Phase 6 Plan 7: Checkout Activation + EUR Relabel Summary

**Checkout.tsx's Place Order button now builds an order payload from the cart and form, POSTs it via the new `web/src/lib/orders.ts` fetch client, and redirects the browser to the returned Stripe/PayPal hosted-checkout URL — with a Stripe-card vs PayPal selector and every shop price relabeled from `$X CAD` to `€X`.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-07T00:09:11+02:00
- **Completed:** 2026-07-07T00:12:38+02:00
- **Tasks:** 3 completed
- **Files modified:** 11

## Accomplishments
- `web/src/lib/orders.ts`: `createOrder(payload)` POSTs to `/api/orders` and resolves `{ orderNumber, redirectUrl }`; `capturePaypalOrder(paypalOrderId)` POSTs to `/api/orders/paypal/capture` and resolves `{ status }` — both public (no `Authorization` header), mirroring `products.ts`'s exact fetch-in-lib pattern
- `Checkout.tsx`'s Place Order button is live: `handleSubmit` maps cart lines to `{productId, variantSku, quantity}`, assembles `shippingAddress` from the form, sends the selected `paymentMethod`, calls `createOrder`, and sets `window.location.href` to the returned URL on success
- A rejected `createOrder` call surfaces an inline error (reusing the existing `errorClassName` styling) instead of a silent no-op (T-06-16), and does not redirect
- A Stripe-card vs PayPal radio selector was added to the Checkout form (D-03), defaulting to card, whose value is sent as `paymentMethod`
- Every `$X CAD` price literal was relabeled to `€X` across `CatalogGrid.tsx`, `Cart.tsx` (3 sites), `ShopDetail.tsx`, and `Checkout.tsx`'s order summary (D-01); every test asserting the old CAD labels (`CatalogGrid.test.tsx`, `Cart.test.tsx`, `ShopDetail.test.tsx`, `Shop.test.tsx`, `Checkout.test.tsx`) was updated in lockstep

## Task Commits

Each task was committed atomically (Tasks 1 and 2 used the TDD RED/GREEN cycle):

1. **Task 1: orders.ts fetch client** — RED: `04ee655` (test), GREEN: `ac8d2ce` (feat)
2. **Task 2: Activate Checkout.tsx submit + provider selector + € summary** — RED: `729ca7f` (test), GREEN: `18961b9` (feat)
3. **Task 3: € relabel CatalogGrid/Cart/ShopDetail + update all CAD-asserting tests** — `cd1bd57` (feat)

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified
- `web/src/lib/orders.ts` - `createOrder`/`capturePaypalOrder` fetch client, mirrors `products.ts`
- `web/src/lib/orders.test.ts` - fetch-call shape, no-Authorization-header, res.ok throw convention for both functions
- `web/src/pages/Checkout.tsx` - live `handleSubmit`, payment-method radio selector, `allFieldsValid`-gated submit button, € subtotal
- `web/src/pages/Checkout.test.tsx` - selector rendering, enable/disable gating, successful-submit redirect, rejection inline-error, € subtotal assertion
- `web/src/pages/Cart.tsx` - 3 `$X CAD` → `€X` sites (line item price, line total, subtotal)
- `web/src/pages/Cart.test.tsx` - updated `$50 CAD`/`110 CAD` assertions to `€50`/`€?110`
- `web/src/pages/ShopDetail.tsx` - detail-page price `$price CAD` → `€price`
- `web/src/pages/ShopDetail.test.tsx` - updated `$25 CAD` assertion to `€25`
- `web/src/components/CatalogGrid.tsx` - catalog-card price `$basePrice CAD` → `€basePrice`
- `web/src/components/CatalogGrid.test.tsx` - updated `/CAD/` assertion to `/€/`, description text "(CAD)" → "(EUR)"
- `web/src/pages/Shop.test.tsx` - updated `/CAD/` assertion to `/€/`

## Decisions Made
- `allFieldsValid` is derived inline from `REQUIRED_FIELDS.every(...)` each render rather than stored as state — avoids a second source of truth that could drift from the per-field `errors` state
- `customerName`/`shippingAddress.addressLine2` are sent as `undefined` (not `''`) when blank, matching the optional-field shape already declared on `CreateOrderPayload`/`ShippingAddress`
- Payment method selector implemented as plain radio inputs in `<label>` wrappers (no new shared component) — two options, consistent with the file's existing hand-rolled input style

## Deviations from Plan

None — plan executed exactly as written. The old "Online payment is coming soon" copy and the permanently-disabled-button test were removed as a natural consequence of activating the submit path (implied by the plan's Task 2 acceptance criteria, not called out as a separate deviation).

## Issues Encountered

None. `window.location.href` assignment in jsdom was handled in tests by replacing `window.location` with a writable plain object via `Object.defineProperty` in `beforeEach`/`afterEach`, avoiding jsdom's "not implemented: navigation" noise while still letting the test assert the redirect target.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `web/src/lib/orders.ts` exports `capturePaypalOrder`, ready for `PaypalReturn.tsx` (Plan 08) to import directly
- Checkout is now a live network-calling form; Plan 08's `CheckoutSuccess.tsx`/`CheckoutCancel.tsx`/`PaypalReturn.tsx` routes are the next consumers of the `redirectUrl` flow this plan wired up
- Full `web` test suite verified green: 23 suites / 121 tests (up from 22/114 at phase start — orders.test.ts is new, Checkout.test.tsx grew from 9 to 12 tests)
- No blockers for subsequent Phase 6 plans

---
*Phase: 06-payment-processing*
*Completed: 2026-07-07*

## Self-Check: PASSED

All created/modified files verified present on disk; all task commit hashes (`04ee655`, `ac8d2ce`, `729ca7f`, `18961b9`, `cd1bd57`) verified present in `git log`.
