---
phase: 07-shopify-integration
plan: 02
subsystem: persistence
tags: [shopify, mongoose-schema, product, order, inventory, shared-types, tdd]

# Dependency graph
requires:
  - phase: 06-payments
    provides: "Order model (shippingAddress, OrderItem.name CR-01), inventory.js /deduct source:'online' path"
provides:
  - "Product.shopifyProductId + Variant.shopifyVariantId/shopifyInventoryItemId/active/syncPending (D-05/D-08/D-15) with fast-lookup indexes"
  - "Order.shippingAddress now optional (D-17 Shopify audit records carry no address)"
  - "Working, real-schema-proven D-17 reuse path: POST /api/inventory/deduct source:'online' with no address"
  - "packages/shared Variant/Product types mirroring the new Mongo fields"
affects: [shopify-outbound-sync, shopify-webhook-handler, shopify-reconcile, shopify-seed]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Shopify identity IDs indexed for post-seed ID-based matching (Pitfall 5)", "OrderItem.name snapshotted from Product.name at write time (CR-01) on the online-deduct path"]

key-files:
  created: [.planning/phases/07-shopify-integration/deferred-items.md]
  modified:
    - api/models/Product.js
    - api/models/Order.js
    - api/routes/inventory.js
    - packages/shared/src/index.ts
    - api/tests/order-model.test.js
    - api/tests/inventory.test.js

key-decisions:
  - "Fixed the missing OrderItem.name on inventory.js's source:'online' branch (snapshot from product.name, CR-01) rather than weakening OrderItemSchema's required:true — the hard-rule ban on changing existing validation semantics + the field's purpose (email name display) both argue for fixing the caller."
  - "Left shippingAddress subdoc field-level requireds (city/postalCode/country) intact; only the top-level required:true was removed, so a supplied address is still fully validated."
  - "orderNumber's ORD-${Date.now()} collision risk (T-07-06) left as-is and flagged in-code for plan 07-06 to replace with Shopify's own order id."

patterns-established:
  - "New Shopify identity fields are indexed the same way variants.sku/version already are, so ongoing sync matching is ID-based (D-08/Pitfall 5), not SKU/name-based."

requirements-worked: [SHOP-18]

# Metrics
duration: ~12min
completed: 2026-08-10
---

# Phase 7 Plan 02: Shopify Persistence Fields + Order Schema Fix Summary

**Product/Variant now carry Shopify identity + lifecycle state (shopifyProductId, per-variant shopifyVariantId/shopifyInventoryItemId/active/syncPending) with fast-lookup indexes and mirrored shared types; Order.shippingAddress is now optional and the D-17 online-deduct reuse path is proven end-to-end against the real Mongo schema.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-10T20:31:05Z
- **Tasks:** 2 (Task 2 executed TDD: RED then GREEN)
- **Files modified:** 6 (+1 created: deferred-items.md)

## Accomplishments

### Task 1 — Product schema + shared types (commit `d3b27e6`)
- `api/models/Product.js` VariantSchema gained: `shopifyVariantId` (String, trim), `shopifyInventoryItemId` (String, trim), `active` (Boolean, default true — D-15 variant soft-delete), `syncPending` (Boolean, default false — D-05 confirm-and-retry).
- ProductSchema gained: `shopifyProductId` (String, trim — D-08).
- Added `ProductSchema.index({ shopifyProductId: 1 })` and `ProductSchema.index({ 'variants.shopifyVariantId': 1 })` (D-08/Pitfall 5 — post-seed matching is by Shopify IDs, not SKU/name).
- The generic toJSON transform was left untouched; new fields pass through.
- `packages/shared/src/index.ts`: `Variant` gained `shopifyVariantId?`, `shopifyInventoryItemId?`, `active: boolean`, `syncPending?`; `Product` gained `shopifyProductId?`.

### Task 2 — Order.shippingAddress optional + real-schema regression (TDD)
- **RED** (commit `c11a5f3`): rewrote order-model's "fails validation when shippingAddress is missing" test to assert it now *saves* without one; added a real-`mongodb-memory-server` block in inventory.test.js exercising `POST /api/inventory/deduct` source:'online' with address-free metadata. Both failed as expected (real ValidationError on `shippingAddress` and `items.0.name`).
- **GREEN** (commit `be78332`): made `Order.shippingAddress` optional (removed `required: true`, kept the subdoc's own field-level requireds); fixed inventory.js's online branch to snapshot `items[].name` from `product.name` (CR-01). All 28 tests in the two suites pass.

## Exact fields added

**api/models/Product.js — VariantSchema:**
- `shopifyVariantId: { type: String, trim: true }`
- `shopifyInventoryItemId: { type: String, trim: true }`
- `active: { type: Boolean, default: true }`
- `syncPending: { type: Boolean, default: false }`

**api/models/Product.js — ProductSchema:**
- `shopifyProductId: { type: String, trim: true }`
- indexes: `{ shopifyProductId: 1 }`, `{ 'variants.shopifyVariantId': 1 }`

**api/models/Order.js:**
- `shippingAddress: { type: ShippingAddressSchema }` (removed `required: true`)

**packages/shared/src/index.ts:**
- `Variant`: `shopifyVariantId?: string`, `shopifyInventoryItemId?: string`, `active: boolean`, `syncPending?: boolean`
- `Product`: `shopifyProductId?: string`

## Task Commits
1. **Task 1** — `d3b27e6` `feat(07-02): add Shopify identity + lifecycle fields to Product/Variant`
2. **Task 2 RED** — `c11a5f3` `test(07-02): add failing real-schema regression for source:online deduct (Pitfall 2)`
3. **Task 2 GREEN** — `be78332` `feat(07-02): make Order.shippingAddress optional + fix online-deduct item name (D-17/Pitfall 2)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Online-deduct path also threw on the required OrderItem.name field**
- **Found during:** Task 2 (empirical reproduction against the real schema).
- **Issue:** RESEARCH Pitfall 2 identified only `shippingAddress` as blocking the `source:'online'` `Order.create()`. In reality the path threw a `ValidationError` on TWO required fields: `shippingAddress` AND `items.0.name`. `OrderItem.name` (required, added in Phase 06 CR-01) was never populated by inventory.js's online branch — so making shippingAddress optional alone would NOT have made the Task 2 acceptance test go green.
- **Fix:** Populated `name: product.name` in the online branch's `Order.create` items (mirroring CR-01's "snapshot the name from Product.name" pattern), rather than weakening `OrderItemSchema.name`'s `required: true` — the hard-rule ban on altering existing validation semantics and the field's email-display purpose both argue for fixing the caller. `api/routes/inventory.js` is outside the plan's `files_modified` list, but the change is the minimal correct fix required to satisfy Task 2's <done> ("the D-17 reuse path is proven to work end-to-end").
- **Files modified:** api/routes/inventory.js
- **Verification:** real-schema test asserts `orders[0].items[0].name === 'Band T-Shirt'` and returns 200.
- **Committed in:** `be78332`

### Flagged, not fixed (per plan)
- `orderNumber: ORD-${Date.now()}` collision risk (T-07-06) — left as-is with an in-code comment pointing to plan 07-06, exactly as the plan directed.

**Total deviations:** 1 auto-fixed (Rule 1). Impact: none negative — it is the fix that makes the plan's own acceptance criterion achievable.

## Deferred Issues (out of scope)
- Pre-existing Mongoose "Duplicate schema index on {orderNumber:1}" warning (Order.js declares both `unique: true` and an explicit `.index()`). Logged to `deferred-items.md`; predates 07-02, no behavioral impact, not fixed here per scope boundary.

## Known Stubs
None. All added fields are wired to real schema paths; the new test exercises the real router.

## Threat Flags
None. No new network endpoint, auth path, or trust boundary introduced. The `active`/`syncPending` fields are internal lifecycle state; identity IDs are opaque Shopify handles. T-07-05/T-07-06 dispositions (accept) are unchanged.

## Verification
- Task 1 node schema check: exits 0 (all five paths present).
- `packages/shared` type-only file compiles clean under `tsc --noEmit --strict` (no tsconfig/build step — it is a `main: src/index.ts` type package).
- `cd api && npx jest tests/order-model.test.js tests/inventory.test.js`: 28 passed.
- `cd api && npm test` (full suite): **16 suites / 174 tests passed** (was 173; +1 for the new real-schema regression). The orderNumber duplicate-index warning is pre-existing and unrelated.

## Next Phase Readiness
- Product/Variant now carry every field the outbound sync (07-04/07-05), webhook handler (07-06), reconcile (07-07) and seed (07-03) need for ID-based matching and lifecycle mapping.
- The D-17 reuse path (Shopify sale -> inventory deduct -> Order audit) is proven against the real schema before any webhook wiring depends on it — the single riskiest hidden blocker for 07-06 is retired.

## Self-Check: PASSED
- api/models/Product.js — FOUND (contains shopifyProductId + variant shopify fields)
- api/models/Order.js — FOUND (shippingAddress no longer required)
- api/routes/inventory.js — FOUND (items name: product.name)
- packages/shared/src/index.ts — FOUND (shopifyVariantId mirrored)
- api/tests/inventory.test.js — FOUND (real-schema source:'online' test)
- api/tests/order-model.test.js — FOUND (saves without shippingAddress)
- Commit d3b27e6 — FOUND
- Commit c11a5f3 — FOUND
- Commit be78332 — FOUND
- api test suite: 16 suites / 174 tests passed

---
*Phase: 07-shopify-integration*
*Completed: 2026-08-10*
