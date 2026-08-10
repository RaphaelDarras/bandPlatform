---
phase: 07-shopify-integration
plan: 06
subsystem: api
tags: [webhooks, shopify, inventory, hmac, idempotency]
requires:
  - "07-02 (Product/Variant Shopify identity + soft-delete fields)"
  - "07-04 (verifyShopifyWebhook HMAC gate)"
  - "07-05 (shopifySync.pushInventory outbound push)"
provides:
  - "api/routes/shopifyWebhooks.js — HMAC-gated inbound webhook router for the D-07 topic set"
affects:
  - "07-10 (mounts this router in api/index.js before express.json())"
tech-stack:
  added: []
  patterns:
    - "Per-route express.raw({type:'application/json'}) for exact signed bytes (Pitfall 4)"
    - "HMAC verification as the literal first statement of every handler (T-07-01)"
    - "Atomic status/uniqueness transitions as idempotency gates (T-07-04)"
key-files:
  created:
    - api/routes/shopifyWebhooks.js
    - api/tests/shopifyWebhooks.test.js
  modified: []
decisions:
  - "orderNumber = Shopify order id (unique index) is the orders/paid idempotency gate"
  - "Reversals (cancelled/refunds) use an atomic Order paid->failed transition as their idempotency ledger"
  - "Content webhooks set basePrice only on create (frozen thereafter, D-12); priceAdjustment absorbs the delta"
  - "INVENTORY_LEVELS_UPDATE deliberately NOT handled (Pitfall 3 / T-07-11 feedback-loop prevention)"
metrics:
  duration: ~7m
  completed: 2026-08-10
  tasks: 3
  files: 2
---

# Phase 7 Plan 6: Inbound Shopify Webhooks Summary

HMAC-gated inbound Shopify webhook router that turns the D-07 topic set into concurrency-safe Mongo writes (D-17 optimistic-lock deduct/restock) and mirrors the authoritative absolute count back to Shopify, with atomic idempotency gates and soft-delete-preserving content sync.

## What was built

`api/routes/shopifyWebhooks.js` — an `express.Router()` with six topic routes, each scoping its own `express.raw({ type: 'application/json' })` and calling `verifyShopifyWebhook(req.body, req.headers['x-shopify-hmac-sha256'], process.env.SHOPIFY_CLIENT_SECRET)` as its literal first statement (401 + zero DB access on failure, T-07-01).

**Webhook topics handled (D-07):**

| Route | Topic | Behavior |
|-------|-------|----------|
| `POST /orders-paid` | orders/paid | D-17 optimistic-lock deduct (`$elemMatch` on `version` + stock floor + versioned `$inc`), one Order audit (`orderNumber` = Shopify order id, `source:'online'`, no shippingAddress), then `pushInventory` with the absolute post-deduct count |
| `POST /orders-cancelled` | orders/cancelled | Restock the full stored Order audit's items (versioned `$inc` up) + push absolute count |
| `POST /refunds-create` | refunds/create | Restock only the refunded quantities (matched by `shopifyVariantId`, SKU fallback) + push absolute count |
| `POST /products-create` | products/create | Insert a new Mongo Product capturing all Shopify ids (D-10), or overwrite if already linked |
| `POST /products-update` | products/update | Overwrite content: name/description, `images[]` replaced with Shopify CDN urls in order (D-13), D-12 price split with basePrice frozen, D-15 dropped-variant soft-delete |
| `POST /products-delete` | products/delete | Soft-delete the product (`active:false`), never hard-delete (D-14) |

`INVENTORY_LEVELS_UPDATE` is deliberately NOT routed (Pitfall 3 / T-07-11 — subscribing would make every outbound `pushInventory` re-fire a webhook at us, an infinite feedback loop). Only the explanatory comment mentions it; grep confirms no route.

## Raw-body + HMAC wiring

Each route mounts its own `const rawJson = express.raw({ type: 'application/json' })` middleware inline (`router.post('/orders-paid', rawJson, handler)`), exactly mirroring how `api/routes/webhooks.js` scopes raw bodies per-route for Stripe/PayPal. This preserves the exact byte buffer Shopify signed. Per the plan (objective note), the router is tested standalone here by mounting it on a fresh Express app at `/api/shopify/webhooks`; the actual mount into `api/index.js` **before** the global `express.json()` is plan 07-10's job (Pitfall 4). This plan does NOT touch `api/index.js`, so existing Stripe/PayPal raw-body handling is untouched.

## Conflict resolution (SHOP-19)

Implemented exactly as specified — idempotency via **atomic transitions**, not an invented scheme:

- **orders/paid** — the Order's `orderNumber` (Shopify order id) carries a unique index. A `findOne({ orderNumber })` pre-check no-ops replays; the unique index is the atomic backstop under a concurrent-delivery race. No double-decrement, no duplicate Order (T-07-04).
- **orders/cancelled + refunds/create** — gated by an atomic `Order.findOneAndUpdate({ orderNumber, status:'paid' }, { $set:{ status:'failed' } })`. Only the first delivery finds a `paid` order to flip and restock; replays (and reversals for orders we never deducted) find nothing and safely no-op. This reuses the Order document as the reversal ledger, mirroring webhooks.js's pending→paid gate.
- **stock direction** — deduct/restock both use the versioned optimistic-lock `$inc`; the deduct adds a `stock >= quantity` floor so an oversell leaves stock non-negative and still acks 200 (shortfall logged). Absolute counts pushed back via `pushInventory`; a push failure flips the variant `syncPending:true` and still acks (never fails the webhook).
- **ack discipline** — malformed/unknown-id payloads ack 200 + log (no retry-storm); a genuine transient DB error surfaces 500 so Shopify's ~48h retry (D-05) does useful work.

## Deviations from Plan

None — plan executed as written. No live Shopify credentials used; `shopifyWebhookAuth` and `shopifySync` are mocked in tests, with raw bodies + HMAC headers crafted locally.

Note: handlers include a small `normId`/`sameId` helper that normalizes GraphQL GIDs (stored by 07-05's sync, e.g. `gid://shopify/ProductVariant/123`) against the bare numeric ids REST webhooks carry, alongside the plan-mandated SKU fallback. This is defensive robustness within the plan's "match by stored id, SKU fallback" instruction, not a scope change.

## Test result

- `npx jest tests/shopifyWebhooks.test.js` — 16 passed (5 orders/paid, 3 orders/cancelled, 2 refunds/create, 2 products/create, 2 products/update, 2 products/delete).
- `npm test` full suite — **20 suites, 219 tests, all green** (was 203; +16 new). Existing Stripe/PayPal webhook suites stayed green — no middleware reordering, `api/index.js` untouched.

## Commits

- `86bd282` test(07-06): orders/paid tests (RED)
- `ecc4aa7` feat(07-06): orders/paid handler (GREEN)
- `476a7c6` test(07-06): cancelled + refunds tests (RED)
- `12eeb2d` feat(07-06): cancelled + refunds handlers (GREEN)
- `f693f32` test(07-06): products/* tests (RED)
- `97b5271` feat(07-06): products/* handlers (GREEN)

## Self-Check: PASSED

- FOUND: api/routes/shopifyWebhooks.js
- FOUND: api/tests/shopifyWebhooks.test.js
- FOUND commits: 86bd282, ecc4aa7, 476a7c6, 12eeb2d, f693f32, 97b5271
- Grep: no INVENTORY_LEVELS_UPDATE / inventory-levels route (comment-only reference)
