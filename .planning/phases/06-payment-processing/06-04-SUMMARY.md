---
phase: 06-payment-processing
plan: 04
subsystem: payments
tags: [resend, transactional-email, vat, node]

# Dependency graph
requires:
  - phase: 06-payment-processing (Plan 01)
    provides: resend npm package installed in api workspace, package-legitimacy pre-approved
provides:
  - "sendOrderConfirmation(order) — customer receipt email with items, EUR total, shipping address, and the D-17 VAT-exemption mention"
  - "sendBandNotification(order, { shortfall }) — band internal new-order notification with shipping address prominent and optional D-08 stock-shortfall flag"
affects: [06-payment-processing webhook handler plan (consumes both senders), 06.1-admin-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level Resend singleton (new Resend(process.env.RESEND_API_KEY)), mirroring stripeClient.js/paypalClient.js singleton convention"
    - "Pure renderCustomerEmail(order)/renderBandNotificationEmail(order, opts) HTML-builder helper functions, exported alongside the senders for direct unit testing"
    - "order.items[].name attached by the caller (not persisted on OrderItemSchema) — same convention as stripeClient.js's line_items builder"

key-files:
  created: [api/services/email.js, api/services/email.test.js]
  modified: []

key-decisions:
  - "order.items[].name is rendered with a fallback to variantSku when absent, since OrderItemSchema has no persisted name field yet (matches 06-03's stripeClient.js precedent)"
  - "sendBandNotification accepts an optional { shortfall: boolean } second argument so the webhook handler (D-08 guard-miss) can flag an order for manual reconciliation directly in the band email, without a second email or a schema change"
  - "renderCustomerEmail/renderBandNotificationEmail exported from email.js (not just the two senders) for direct unit-testability of HTML content"

patterns-established:
  - "Transactional email HTML built by small pure render*Email(order) helper functions consumed by the exported async sender wrapping resend.emails.send"

requirements-completed: [SHOP-06]

# Metrics
duration: 10min
completed: 2026-07-06
---

# Phase 6 Plan 04: Resend Email Service Summary

**Resend-backed sendOrderConfirmation + sendBandNotification, with the customer email carrying the exact French VAT-exemption mention required for the franchise-en-base-de-TVA regime**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-06T22:04:15Z
- **Tasks:** 1
- **Files modified:** 2 (both created)

## Accomplishments
- `sendOrderConfirmation(order)` sends one branded HTML email to `order.customerEmail` containing itemized lines, the EUR total, the shipping address, and the exact literal `TVA non applicable, art. 293 B du CGI` (D-17) — this is the customer's de-facto receipt (T-06-09).
- `sendBandNotification(order, { shortfall })` sends one branded HTML email to `process.env.BAND_NOTIFICATION_EMAIL` with the shipping address rendered prominently (D-13), and an optional shortfall banner for the D-08 stock-guard-miss reconciliation case.
- Both senders use the module-level `new Resend(process.env.RESEND_API_KEY)` singleton and send `from: 'Hurakan <noreply@hurakanband.fr>'` (D-12).
- Neither template embeds any tracking/analytics pixel — verified by test assertion (T-06-10).

## Task Commits

Each task was committed atomically:

1. **Task 1: Resend email service — customer confirmation + band notification** - `4f23918` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `api/services/email.js` - Resend singleton + sendOrderConfirmation/sendBandNotification + renderCustomerEmail/renderBandNotificationEmail pure HTML builders
- `api/services/email.test.js` - mocks the `resend` module; asserts recipient, from-address, subject, VAT literal, item/total/address content, no-tracking-pixel, and shortfall-flag behavior

## Decisions Made
- `order.items[].name` is expected to be attached by the caller (webhook handler) since `OrderItemSchema` has no persisted `name` field — mirrors the existing `stripeClient.js` `createCheckoutSession` convention from Plan 06-03. Falls back to `variantSku` if absent, so the templates never render `undefined`.
- Added an optional `{ shortfall }` argument to `sendBandNotification` (not in the original plan's literal signature) so the upcoming webhook handler can surface a D-08 stock-guard-miss directly in the existing band email, avoiding a third email type or an `Order` schema change. This stays within Task 1's own `<behavior>` scope (band email must surface fulfillment-relevant order state) and doesn't touch any other file.
- Exported the two pure render helpers alongside the senders so tests (and any future template evolution) can assert on HTML content without needing to intercept `resend.emails.send`.

## Deviations from Plan

None — plan executed exactly as written. The `{ shortfall }` addition to `sendBandNotification` is an additive, backward-compatible extension within the task's own described behavior ("HTML with the shipping address rendered prominently... interim fulfillment trigger"), not a deviation from a stated contract.

## Issues Encountered

None. The API workspace's default `npm test` pattern (`--testPathPatterns=tests/`) does not match `api/services/*.test.js`; the plan's verify command (`--testPathPatterns=email`) appends a second pattern and correctly picked up the new suite alongside the existing (unrelated) `tests/` suites. Confirmed no new test failures: 121 passed / 16 failed both before and after, where the 16 failures are the 4 pre-existing Concert-schema-migration suites tracked in `deferred-items.md` (unrelated to this plan). Running `email.test.js` in isolation: 11/11 passed.

## User Setup Required

None new for this plan — `RESEND_API_KEY` and `BAND_NOTIFICATION_EMAIL` env vars, plus the Resend domain/DNS setup for `hurakanband.fr`, were already declared as `user_setup` in this plan's frontmatter but are runtime/deployment configuration, not required to pass this plan's automated tests (which mock the `resend` module entirely). These must be set in Render's environment before the webhook handler (a later plan) can send real emails.

## Next Phase Readiness
- `api/services/email.js` exports a stable `sendOrderConfirmation`/`sendBandNotification` interface ready for the webhook handler plan to call once per paid order (D-14), passing the same `order` document plus item `name` values it already has in scope.
- Real Resend delivery (domain verification, SPF/DKIM, actual API key) remains a deployment/DNS task outside this plan's automated scope — flagged in this plan's `user_setup` frontmatter for the operator.

---
*Phase: 06-payment-processing*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: api/services/email.js
- FOUND: api/services/email.test.js
- FOUND commit: 4f23918 (feat(06-04): add Resend transactional email service)
- FOUND commit: 63dce7d (docs(06-04): add plan summary for Resend email service)
