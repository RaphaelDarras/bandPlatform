---
phase: 07-shopify-integration
plan: 10
subsystem: api
tags: [shopify, webhooks, routing, retire, payments]
requires: ["07-06", "07-07", "07-08"]
provides: ["shopify-routes-mounted", "phase6-payment-retired"]
affects: [api/index.js, packages/shared/src/index.ts]
tech-stack:
  removed: [stripe, "@paypal/paypal-server-sdk", resend]
  patterns: [raw-body-before-express-json, lazy-singleton-external-client]
key-files:
  modified:
    - api/index.js
    - packages/shared/src/index.ts
    - api/package.json
  deleted:
    - api/routes/orders.js
    - api/routes/webhooks.js
    - api/services/stripeClient.js
    - api/services/paypalClient.js
    - api/services/email.js
    - api/services/orderNumber.js
    - api/services/amounts.js
    - api/tests/orders.test.js
    - api/tests/webhooks-stripe.test.js
    - api/tests/webhooks-paypal.test.js
    - api/tests/paypal-interop.test.js
    - api/services/email.test.js
    - api/services/orderNumber.test.js
    - api/services/amounts.test.js
decisions:
  - "Removed the /api/webhooks (Stripe/PayPal) mount entirely per D-18; the new /api/shopify/webhooks mount takes its place in the same pre-express.json() raw-body block"
  - "Pruned orphaned CreateOrderResponse shared type; kept Order/OrderItem/ShippingAddress (still mirror the retained Order model)"
metrics:
  duration: ~12m
  tasks: 2
  files-changed: 17
  completed: 2026-08-10
---

# Phase 7 Plan 10: Shopify Integration Wiring + Phase 6 Payment Retirement Summary

Mounted the Shopify webhook router before `express.json()` (raw-body HMAC ordering, Pitfall 4) and the reconcile router in the parsed-JSON block, then deleted the superseded self-built Stripe/PayPal/Resend checkout code, its tests, and its dependencies (D-18), leaving the Order/Sale/InventoryAdjustment models and products/inventory routes intact.

## What Was Built

### Task 1 — Shopify route mounts in `api/index.js` (commit `9af6c49`)
Middleware ordering, top to bottom, in `api/index.js`:

1. `app.use('/api/shopify/webhooks', require('./routes/shopifyWebhooks'));` — mounted **BEFORE** `express.json()`, replacing the old `/api/webhooks` (Stripe/PayPal) mount in the same pre-JSON raw-body block. The comment was updated to reference Shopify HMAC. `shopifyWebhooks.js` scopes `express.raw()` per-route internally, so raw bytes reach the HMAC verifier intact.
2. `app.use(express.json());` — global JSON parser, unchanged, still after the webhook mount.
3. `app.use(cors(...))`, swagger, `/health` — unchanged.
4. Normal parsed-JSON routes: `auth`, `products`, `inventory`, `concerts`, `sales`, and the **new** `app.use('/api/shopify', require('./routes/shopify'));` (reconcile) — replacing the removed `/api/orders` mount.

The old `require('./routes/webhooks')` and `require('./routes/orders')` mounts are both gone (they would throw `MODULE_NOT_FOUND` at boot once the files are deleted in Task 2 — sequenced in the same plan).

### Task 2 — Retire dead payment code + deps + type (commit `f956869`)
Deleted (14 files): routes `orders.js`, `webhooks.js`; services `stripeClient.js`, `paypalClient.js`, `email.js`, `orderNumber.js`, `amounts.js`; tests `tests/orders.test.js`, `tests/webhooks-stripe.test.js`, `tests/webhooks-paypal.test.js`, `tests/paypal-interop.test.js`, `services/email.test.js`, `services/orderNumber.test.js`, `services/amounts.test.js`.

Uninstalled `stripe`, `@paypal/paypal-server-sdk`, `resend` from the `api` workspace (`api/package.json` no longer lists them). Pruned the orphaned `CreateOrderResponse` interface from `packages/shared/src/index.ts`.

**Kept (verified intact):** `models/Order.js`, `models/Sale.js`, `models/InventoryAdjustment.js`, `routes/products.js`, `routes/inventory.js` — these power Shopify sync + audit. Shared types `Order`/`OrderItem`/`ShippingAddress` retained (still mirror the kept Order model).

## Retired vs Kept — payment surface

| Retired (deleted) | Kept |
|---|---|
| routes orders.js, webhooks.js | models Order/Sale/InventoryAdjustment |
| services stripeClient, paypalClient, email, orderNumber, amounts | routes products, inventory |
| deps stripe, @paypal/paypal-server-sdk, resend | dep @shopify/admin-api-client |
| type CreateOrderResponse | types Order/OrderItem/ShippingAddress |

## Verification

- `cd api && node -c index.js` → exits 0.
- awk raw-body ordering check → `/api/shopify/webhooks` line precedes `express.json()` line (exit 0).
- `grep` checks → `/api/shopify'` present; no `routes/orders'` or `routes/webhooks'` requires remain.
- Retired files absent; kept files present; `CreateOrderResponse` no longer in shared types; deps absent from `api/package.json`.
- `cd api && npm test` → **18 suites, 211/211 passed**. Drop from the 243 baseline = exactly the 32 tests in the 4 deleted `tests/` payment files (`--testPathPatterns=tests/` never ran the co-located `services/*.test.js`, so their deletion did not change the count). No unintended regressions, no dangling imports.
- `cd web && npm test` → **21 files, 158/158 passed** (web unaffected).

## Deviations from Plan

None — plan executed exactly as written. No STOP conditions hit. All retired-module `require()`s were confined to `index.js` (fixed in Task 1) and the retiring files/tests themselves; no external dependent existed, so deletion was safe. No mobile POS or remaining-flow dependency touched.

## Threat Model Compliance

- **T-07-16 (HMAC / raw-body ordering):** mitigated — `shopifyWebhooks` mounted before `express.json()`; awk ordering check enforces it.
- **T-07-17 (dead payment attack surface):** mitigated — `orders.js`/`webhooks.js` and their mounts deleted; unused Stripe/PayPal/Resend deps removed.

## Deferred / Out of Scope

- Pre-existing Mongoose warning: `Duplicate schema index on {"orderNumber":1}` in `models/Order.js` (both `index: true` and `schema.index()`). Not introduced by this plan and not in its file set — left untouched.

## Self-Check: PASSED

- `api/index.js` — FOUND, contains `/api/shopify/webhooks` before `express.json()`.
- Retired files — confirmed absent.
- Commit `9af6c49` — FOUND.
- Commit `f956869` — FOUND.
