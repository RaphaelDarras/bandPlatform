---
phase: 06-payment-processing
plan: 08
subsystem: payments
tags: [react, react-router, checkout, stripe, paypal]

# Dependency graph
requires:
  - phase: 06-payment-processing (plan 07)
    provides: "web/src/lib/orders.ts runtime fetch client (createOrder, capturePaypalOrder)"
provides:
  - "CheckoutSuccess.tsx optimistic thank-you page + clearCart (D-15)"
  - "CheckoutCancel.tsx payment-cancelled note + CTA to cart (D-16)"
  - "PaypalReturn.tsx capture-on-mount then redirect to success/cancel"
  - "App.tsx routes: checkout/success, checkout/cancel, checkout/paypal-return"
affects: [06.1-admin-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CheckoutSuccess/Cancel reuse Cart.tsx's heading/body/CTA empty-state block shape"
    - "PaypalReturn mirrors ShopDetail.tsx's useEffect-on-mount fetch pattern, but redirects via useNavigate instead of rendering fetched data"

key-files:
  created:
    - web/src/pages/CheckoutSuccess.tsx
    - web/src/pages/CheckoutSuccess.test.tsx
    - web/src/pages/CheckoutCancel.tsx
    - web/src/pages/PaypalReturn.tsx
  modified:
    - web/src/App.tsx

key-decisions:
  - "PaypalReturn reads both `token` (PayPal's order id, appended by PayPal itself on redirect) and `order` (our orderNumber, carried in the returnUrl built by api/services/paypalClient.js) query params -- token is what gets captured, order is what's forwarded to the success page"
  - "Missing `token` on PaypalReturn mount is treated as a failure path (redirect to /checkout/cancel) rather than an error render, since there's nothing recoverable to show at that URL"
  - "CheckoutSuccess.test.tsx spies on useCartStore.getState().clearCart directly (mutating the current store-state object's method) rather than mocking the whole cartStore module, to exercise the real store and assert lines are actually emptied afterward"

patterns-established: []

requirements-completed: [SHOP-04, SHOP-05]

# Metrics
duration: 6min
completed: 2026-07-07
---

# Phase 6 Plan 8: Post-Payment Pages + Routes Summary

**Three new runtime-only pages close the browser side of the payment loop: an optimistic `/checkout/success` (order number + "email on its way" + one-time `clearCart()`, no polling), a `/checkout/cancel` returning the customer to their still-saved cart, and a `/checkout/paypal-return` that calls `capturePaypalOrder(token)` once on mount then redirects — all three registered in `App.tsx` with no loader key, matching the `shop/:id` D-06 convention.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-07T00:37:14+02:00 (approx, first Read after prior plan's commit)
- **Completed:** 2026-07-07T00:43:02+02:00
- **Tasks:** 3 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `CheckoutSuccess.tsx`: reads `order` from `useSearchParams`, calls `useCartStore.getState().clearCart()` exactly once on mount, renders a static "Order Confirmed" thank-you with the order number and a confirmation-email note — makes **no** fetch to the API, honoring D-15's optimistic/no-polling rule; the webhook remains the sole paid-state authority (T-06-17 mitigated by construction)
- `CheckoutCancel.tsx`: static "Payment Cancelled" page with a "no charge was made" note and a CTA back to `/cart` (D-16) — reached from both Stripe's `cancel_url` and PayPal's `cancelUrl`/capture-failure path
- `PaypalReturn.tsx`: on mount, reads `token` (PayPal's order id) and `order` (our orderNumber) from the query string, calls `capturePaypalOrder(token)` exactly once, then `navigate`s to `/checkout/success?order=...` on success or `/checkout/cancel` on failure/missing token — a single capture call, no polling loop (D-15); capture only moves funds for a real approved order id, stock/email/paid-status remain gated by the webhook (T-06-18 mitigated)
- `App.tsx`: registered `checkout/success`, `checkout/cancel`, `checkout/paypal-return` directly after `checkout` and before the `*` catch-all, each with `lazy: () => import(...)` and **no** `loader` key, matching the `shop/:id` runtime-only convention

## Task Commits

1. **Task 1: CheckoutSuccess.tsx (TDD)** — RED: `f87d5cb` (test), GREEN: `2834a5d` (feat)
2. **Task 2: CheckoutCancel.tsx + PaypalReturn.tsx** — `e4b137d` (feat)
3. **Task 3: Register routes in App.tsx** — `2e51906` (feat)

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified

- `web/src/pages/CheckoutSuccess.tsx` - optimistic thank-you, `clearCart()` on mount, no fetch
- `web/src/pages/CheckoutSuccess.test.tsx` - order-number rendering, single `clearCart` call, no-fetch assertion
- `web/src/pages/CheckoutCancel.tsx` - "Payment cancelled" message + CTA to `/cart`
- `web/src/pages/PaypalReturn.tsx` - capture-on-mount then redirect to success/cancel
- `web/src/App.tsx` - three new no-loader routes inserted before the `*` catch-all

## Decisions Made

- `PaypalReturn` reads both `token` (PayPal-appended, the PayPal order id to capture) and `order` (our own `orderNumber`, carried through PayPal's `returnUrl` per `api/services/paypalClient.js`) — the former drives the capture call, the latter is forwarded verbatim to `/checkout/success`
- A missing `token` on mount redirects straight to `/checkout/cancel` (treated as a failure path, not an inline error state) since there is nothing actionable to show at that URL
- `CheckoutSuccess.test.tsx` spies on the real `useCartStore.getState().clearCart` (not a mocked module) so the test also asserts the store's `lines` are genuinely emptied, not just that a mock was invoked

## Deviations from Plan

None — plan executed exactly as written. One clarification worth recording: the plan's "no loader key ... excluded from the static prerender" phrasing describes the same convention already established for `/shop`, `/cart`, and `/checkout` in Plan 05-11 — vite-react-ssg still emits a static HTML *shell* for these non-dynamic paths (confirmed via `npm run build --workspace=web`: `dist/checkout/success/index.html`, `dist/checkout/cancel/index.html`, `dist/checkout/paypal-return/index.html` were all generated), but **no build-time loader data is baked in**. Only truly dynamic segments like `shop/:id` are excluded from getting a shell at all (no `getStaticPaths`). This matches existing precedent exactly and is not a deviation from intended behavior — the `prerender-output.test.ts` suite (14/14) and `npm run build --workspace=web` both passed without modification.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three post-payment browser destinations exist and are routed: optimistic success (clears cart, no polling), cancel (returns to cart), and PayPal capture-then-redirect
- Full `web` test suite verified green: 24 suites / 124 tests (up from 23/121 at plan start — `CheckoutSuccess.test.tsx` is new with 3 tests)
- `npx tsc --noEmit -p web` clean; `npm run build --workspace=web` succeeds, generating the expected static shells for the three new non-dynamic routes
- This was the last plan (8 of 8) for Phase 06-payment-processing — Phase 06.1 (Admin panel) is next per STATE.md's roadmap note, needing the Order records this phase's checkout/payment flow persists

---
*Phase: 06-payment-processing*
*Completed: 2026-07-07*

## Self-Check: PASSED

All created/modified files verified present on disk (`web/src/pages/CheckoutSuccess.tsx`, `web/src/pages/CheckoutSuccess.test.tsx`, `web/src/pages/CheckoutCancel.tsx`, `web/src/pages/PaypalReturn.tsx`, `web/src/App.tsx`); all task commit hashes (`f87d5cb`, `2834a5d`, `e4b137d`, `2e51906`) verified present in `git log`.
