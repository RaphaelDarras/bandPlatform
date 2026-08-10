---
phase: 07-shopify-integration
plan: 07
subsystem: shopify-outbound-sync
tags: [shopify, outbound-sync, inventory, pos, best-effort]
requires: ["07-05 shopifySync (pushProduct/archiveProduct/pushInventory)", "07-02 Product/Variant Shopify id fields + syncPending"]
provides: ["shopifyOutbound.js orchestration wrapper (syncProductOut/archiveProductOut/syncInventoryOut/isShopifyConfigured)", "outbound push hooks on every Mongo product/stock write path"]
affects: ["api/routes/products.js", "api/routes/inventory.js", "api/routes/sales.js"]
tech_stack:
  added: []
  patterns: ["config-guarded best-effort side-effect", "fire-and-forget .catch(() => {})", "absolute-count inventory push (D-06)", "syncPending confirm-and-retry marking (D-05)"]
key_files:
  created:
    - api/services/shopifyOutbound.js
    - api/tests/shopifyOutbound.test.js
  modified:
    - api/routes/products.js
    - api/routes/inventory.js
    - api/routes/sales.js
decisions:
  - "Route hooks call the wrapper via its module namespace (shopifyOutbound.syncInventoryOut) not a destructured import, so the push is spy-interceptable in tests and swap-safe."
  - "POST /restock/batch fires pushes by iterating the committed `results` AFTER session.withTransaction resolves and before the catch — an aborted (409/500) batch reaches none of them, so it mirrors nothing (D-06 all-or-nothing preserved)."
  - "sales.js /batch fires one push per deducted line item inside the item loop (only reached for non-skipped, created sales), matching 'once per changed variant'."
metrics:
  duration: ~5 min
  tasks: 3
  files_created: 2
  files_modified: 3
  completed: 2026-08-10
requirements: [SHOP-18]
---

# Phase 07 Plan 07: Outbound Shopify Push Wiring Summary

Every Mongo product/stock write (products create/update/soft-delete, inventory deduct/restock/release/batch, and the POS `sales.js` batch/void/unvoid path) now fires a best-effort, config-guarded Shopify mirror through a single `shopifyOutbound.js` wrapper that persists Shopify ids, sends the absolute post-write count (D-06), marks `syncPending` on failure (D-05), and never throws or adds latency to the caller.

## What was built

`api/services/shopifyOutbound.js` — the single outbound entry point. Exports:
- `isShopifyConfigured()` — `true` only when both `SHOPIFY_CLIENT_ID` and `SHOPIFY_SHOP_DOMAIN` are present (read at call time, boot-safe).
- `syncProductOut(product)` — no-op when unconfigured; else `pushProduct(product)` then persists the returned `shopifyProductId` + per-variant `shopifyVariantId`/`shopifyInventoryItemId` back onto the Mongo doc (matched by SKU on first link), clears `syncPending`, and `save()`s. Swallows all errors.
- `archiveProductOut(product)` — no-op when unconfigured or the product has no `shopifyProductId`; else `archiveProduct(product.shopifyProductId)`. Swallows all errors.
- `syncInventoryOut(productId, variantSku)` — no-op when unconfigured; else loads the product, and if the variant has a `shopifyInventoryItemId` calls `pushInventory(id, variant.stock)` (ABSOLUTE, D-06). On push failure sets that variant `syncPending:true` via an atomic `$set` (D-05) and resolves. Never throws.

## Call sites added (all fire-and-forget `.catch(() => {})`, additive side effects only)

**products.js** (`require('../services/shopifyOutbound')`):
- POST `/` create → `syncProductOut(product)` after `Product.create`, before the 201.
- PUT `/:id` update → `syncProductOut(updatedProduct)` after the 404 check, before the 200.
- DELETE `/:id` soft-delete → `archiveProductOut(product)` after the 404 check, before the 200.

**inventory.js** (`require('../services/shopifyOutbound')`):
- POST `/deduct` → `syncInventoryOut(productId, variantSku)` before the 200.
- POST `/restock` → `syncInventoryOut(productId, variantSku)` before the 200.
- POST `/release` → `syncInventoryOut(productId, variantSku)` before the 200.
- **POST `/restock/batch`** → iterates the committed `results` and fires `syncInventoryOut(productId, variantSku)` **once per adjusted variant, only after `session.withTransaction(...)` resolves** (inside the `try`, before the `catch`). The 409 (`BatchAdjustmentError`) and 500 abort paths are in the `catch` and reach none of the pushes, so a partial/aborted batch mirrors nothing. The all-or-nothing transaction contract is untouched.

**sales.js** (`require('../services/shopifyOutbound')`) — the dominant POS stock-changing path (D-01 criterion 3):
- POST `/batch` → `syncInventoryOut(productId, variantSku)` once per deducted line item (inside the item loop, only reached for created/non-skipped sales).
- POST `/:id/void` → `syncInventoryOut(item.productId, item.variantSku)` per restored item.
- POST `/:id/unvoid` → `syncInventoryOut(item.productId, item.variantSku)` per re-deducted item.

None of the hooks change any status code, response body, validation, optimistic-lock logic, idempotency-skip behaviour, the batch transaction contract, or the "stock can go negative — concert sales never rejected" contract.

## Tests

- `api/tests/shopifyOutbound.test.js` (new, 16 tests): config guard both states; unconfigured no-op/no-throw for all three exports; `syncProductOut` id persistence + best-effort on reject; `archiveProductOut` guard + best-effort; `syncInventoryOut` absolute-count push, no-op without inventory-item id, and `syncPending` marking on push failure; **POS section** mounts the real `sales.js` router and proves `/batch` fires `syncInventoryOut` exactly once per changed variant and is a zero-Shopify-work no-op when unconfigured.
- `inventory-batch.test.js` stays green (11 tests) — the batch push no-ops because Shopify is unconfigured, and the D-06 all-or-nothing / negative-stock / validation cases are unaffected.
- Full api suite: **235/235 passed** (was 219; +16 new). Verify commands `npx jest tests/sales-batch.test.js tests/shopifyOutbound.test.js` and `npx jest tests/products.test.js tests/inventory.test.js tests/products-put.test.js tests/inventory-stock.test.js tests/inventory-batch.test.js` both exit 0.

## Deviations from Plan

None — plan executed exactly as written (including the revised Task 2 requirement to also hook `POST /restock/batch`).

## Threat model

- T-07-13 (DoS via push failure blocking the core write) — mitigated: all pushes are fire-and-forget/error-swallowed; a Shopify outage never fails a POS `/batch` sale, void, unvoid, inventory adjustment, or product write; inventory failures set `syncPending` for retry.
- T-07-10 (delta vs absolute) — mitigated: `syncInventoryOut` sends `variant.stock` (absolute post-write value), inherited by `shopifySync.pushInventory` (D-06).

No new threat surface beyond the register.

## Commits

- `1b6942a` test(07-07): add failing spec for shopifyOutbound push wrapper (RED)
- `53e2154` feat(07-07): add shopifyOutbound best-effort push orchestration wrapper (GREEN)
- `a47ce5b` feat(07-07): hook outbound Shopify pushes into products.js and inventory.js
- `d5fc7a2` feat(07-07): mirror POS sales.js stock writes to Shopify (D-01 criterion 3)

## Self-Check: PASSED
- FOUND: api/services/shopifyOutbound.js
- FOUND: api/tests/shopifyOutbound.test.js
- FOUND commits: 1b6942a, 53e2154, a47ce5b, d5fc7a2
