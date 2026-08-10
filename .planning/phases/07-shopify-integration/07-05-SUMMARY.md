---
phase: 07-shopify-integration
plan: 05
subsystem: api
tags: [shopify, graphql, productSet, inventorySetQuantities, sync, jest]

# Dependency graph
requires:
  - phase: 07-02
    provides: "Product/Variant Shopify identity fields (shopifyProductId, shopifyVariantId, shopifyInventoryItemId, active, syncPending)"
  - phase: 07-04
    provides: "shopifyClient.shopifyRequest(query, variables) authenticated Admin GraphQL wrapper + shopifyTokenCache"
provides:
  - "api/services/shopifySync.js — outbound push engine: pushProduct / archiveProduct / pushInventory"
  - "productSet create-or-update mapping (title/description/images/price + per-variant SKU/options)"
  - "inventorySetQuantities absolute-count push (no delta, ignoreCompareQuantity:true)"
  - "captured Shopify ids returned keyed by SKU for the caller to persist (D-08)"
affects: [07-06, 07-07, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Outbound external-API service: talks only to Shopify via shopifyRequest, never reads/writes Mongo, never decides when to push"
    - "Mutation-body constants + userErrors-throwing helper shared across push functions"

key-files:
  created:
    - api/services/shopifySync.js
    - api/tests/shopifySync.test.js
  modified: []

key-decisions:
  - "D-15 variant deactivation implemented by EXCLUDING active:false variants from the authoritative productSet variants payload (Shopify drops omitted variants); no per-variant status field used because verifying its existence needs a live-schema check the mocked/config-guarded build path does not perform"
  - "Open Q1 @idempotent directive deferred: additive safe-retry sugar, not required for the mutation, and needs a live-schema introspection unavailable without real credentials; the absolute-count overwrite is itself idempotent"
  - "Product images mapped to productSet input.files[{ originalSource, contentType: 'IMAGE' }] for Shopify to re-host (D-13)"
  - "Initial inventory seeded on productSet create only (via SHOPIFY_LOCATION_ID); steady-state stock owned by pushInventory (D-01)"

patterns-established:
  - "TDD RED/GREEN per task: failing test commit then implementation commit"
  - "shopifyRequest fully mocked in unit tests (plain-unit amounts.test.js style) — no network, no real env values"

requirements-completed: [SHOP-18]

# Metrics
duration: ~15min
completed: 2026-08-10
---

# Phase 7 Plan 05: Outbound Shopify Sync Engine Summary

**`shopifySync.js` mirrors Mongo product content and inventory into Shopify — `pushProduct`/`archiveProduct` via a single `productSet` mutation and `pushInventory` via an absolute-count `inventorySetQuantities` call, all boundary-disciplined and unit-tested with `shopifyRequest` mocked.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-10
- **Tasks:** 2 (both TDD)
- **Files modified:** 2 (both created)

## Accomplishments
- `pushProduct(mongoProduct)` builds a `ProductSetInput` (create when no `shopifyProductId`, update when present), maps title/description/images/price and per-variant SKU + Size/Color option values, and returns the captured `{ shopifyProductId, variants:[{ sku, shopifyVariantId, shopifyInventoryItemId }] }` (D-08/D-10/D-12/D-13/D-14).
- `active:false` Mongo variants are deactivated Shopify-side by exclusion from the authoritative productSet payload (D-15) — the outbound mirror of 07-06's inbound handling.
- `archiveProduct(shopifyProductId)` soft-deletes by flipping status to DRAFT (D-14).
- `pushInventory(shopifyInventoryItemId, absoluteQuantity)` sends the ABSOLUTE count via `inventorySetQuantities` with `ignoreCompareQuantity:true` — structurally incapable of the delta double-count bug (D-01/D-06, threat T-07-10).
- 15 new unit tests, `shopifyRequest` mocked; full api suite 203/203 (was 188).

## Task Commits

Each task followed the TDD RED → GREEN cycle:

1. **Task 1 (RED): productSet + archive contract tests** - `e30bba3` (test)
2. **Task 1 (GREEN): pushProduct + archiveProduct** - `25ca297` (feat)
3. **Task 2 (RED): pushInventory absolute-count tests** - `abaa023` (test)
4. **Task 2 (GREEN): pushInventory** - `19f9aa1` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified
- `api/services/shopifySync.js` - Outbound Shopify sync engine: `pushProduct`, `archiveProduct`, `pushInventory`. Talks only to Shopify via `shopifyRequest`; no Mongo I/O.
- `api/tests/shopifySync.test.js` - 15 unit tests with `shopifyRequest` mocked (create/update branch, ACTIVE/DRAFT status, price = basePrice+priceAdjustment, image re-host, id capture, D-15 deactivation, absolute inventory 12→12/0→0, location targeting, userErrors throws).

## Exports & Signatures

```
pushProduct(mongoProduct) -> { shopifyProductId, variants:[{ sku, shopifyVariantId, shopifyInventoryItemId }] }
archiveProduct(shopifyProductId) -> { shopifyProductId, status }
pushInventory(shopifyInventoryItemId, absoluteQuantity) -> inventoryAdjustmentGroup
```

The interface contract relied on by 07-06/07-07 is honored exactly.

## Mapping Detail (Mongo → Shopify GraphQL)

- **Product:** `title=name`, `descriptionHtml=description`, `status = active ? 'ACTIVE' : 'DRAFT'`, `files=[{ originalSource: imageUrl, contentType:'IMAGE' }]`, `productOptions` built from active variants' Size/Color, `input.id` set only when `shopifyProductId` exists.
- **Variant:** `{ sku, price: String(basePrice + priceAdjustment), optionValues:[{optionName:'Size'|'Color', name}] }`; `inventoryQuantities` seeded on create only (when `SHOPIFY_LOCATION_ID` set). `active:false` variants excluded (D-15).
- **Inventory:** `inventorySetQuantities` input `{ name:'available', reason:'correction', ignoreCompareQuantity:true, quantities:[{ inventoryItemId, locationId: SHOPIFY_LOCATION_ID, quantity: absoluteQuantity }] }` — quantity passed verbatim, no delta arithmetic.
- **Errors:** any `userErrors[]` on a mutation payload throws.

## Decisions Made
- **D-15 via exclusion, not a status field** — see key-decisions. The plan permits a per-variant disable field "if the target productSet schema exposes" one, but confirming that requires live-schema introspection which this no-credentials/mocked build path deliberately avoids; exclusion is the plan's documented default and matches productSet's authoritative-variant-list semantics.
- **@idempotent directive deferred (Open Q1)** — additive, not required, needs live schema; absolute-count overwrite is already idempotent. Documented inline in `shopifySync.js` so a future live deployment can layer it on without changing the call shape.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes (Rules 1-4) were needed; existing suites stayed green throughout.

## Issues Encountered
None.

## Test Result
- `cd api && npx jest tests/shopifySync.test.js` → 15/15 passed.
- `cd api && npm test` → 19 suites, 203/203 passed (188 baseline + 15 new; no regressions).

## User Setup Required
None for this plan. Runtime pushes require `SHOPIFY_LOCATION_ID` (plus the 07-01 Shopify credentials) to be configured on the deployed API, but the config-guarded build path and all tests run without them.

## Next Phase Readiness
- Outbound push surface is complete and stable for 07-06 (inbound webhooks calling `pushInventory` with the post-deduct absolute count) and 07-07 (route hooks calling `pushProduct`/`archiveProduct`).
- Callers own persistence of the returned Shopify ids and the `syncPending` marking (this service is pure Shopify I/O by design).

## Self-Check: PASSED

- Files verified present: `api/services/shopifySync.js`, `api/tests/shopifySync.test.js`, `.planning/phases/07-shopify-integration/07-05-SUMMARY.md`.
- Commits verified in history: `e30bba3`, `25ca297`, `abaa023`, `19f9aa1`.

## TDD Gate Compliance

Both tasks completed the RED → GREEN cycle:
- Task 1: `e30bba3` (test/RED) → `25ca297` (feat/GREEN).
- Task 2: `abaa023` (test/RED) → `19f9aa1` (feat/GREEN).
No REFACTOR commits were needed. No test passed unexpectedly during RED (module-not-found for Task 1, `pushInventory is not a function` for Task 2).

---
*Phase: 07-shopify-integration*
*Completed: 2026-08-10*
