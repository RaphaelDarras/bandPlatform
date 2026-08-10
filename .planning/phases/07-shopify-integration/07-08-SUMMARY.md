---
phase: 07-shopify-integration
plan: 08
subsystem: shopify-integration
tags: [reconcile, cron, shared-secret, inventory-drift, keep-alive]
requires:
  - "shopifyOutbound.syncInventoryOut / isShopifyConfigured (07-07)"
  - "shopifySync push/pull (07-05)"
  - "shopifyClient/shopifyRequest (07-04)"
provides:
  - "POST /reconcile shared-secret-gated reconciliation endpoint (api/routes/shopify.js)"
  - "scheduled GitHub Actions reconcile trigger (.github/workflows/shopify-reconcile.yml)"
affects:
  - "api/index.js (router mounting deferred to plan 07-10)"
tech-stack:
  added: []
  patterns:
    - "crypto.timingSafeEqual length-guarded shared-secret header auth (non-JWT, external caller)"
    - "config-guarded no-op path (isShopifyConfigured) for unconfigured environments"
    - "free GitHub Actions cron as external trigger + Render keep-alive ping"
key-files:
  created:
    - api/routes/shopify.js
    - api/tests/shopifyReconcile.test.js
    - .github/workflows/shopify-reconcile.yml
  modified: []
decisions:
  - "Reconcile authenticated by X-Reconcile-Secret via crypto.timingSafeEqual, NOT authenticateToken (caller is GitHub Actions, no JWT) — T-07-03"
  - "Eligible variant = active AND (has shopifyInventoryItemId OR syncPending); inactive variants skipped (D-15)"
  - "Router mounting into api/index.js deferred to plan 07-10 (integration); tested standalone here"
  - "Daily cron cadence (D-05 backstop), adjustable to weekly; curl -f fails on non-2xx"
metrics:
  duration: "~15m"
  completed: "2026-08-10"
  tasks: 2
  files: 3
---

# Phase 07 Plan 08: Shopify Reconcile Endpoint & Scheduled Trigger Summary

Shared-secret-gated `POST /reconcile` endpoint that re-asserts Mongo's authoritative absolute stock to Shopify (drift repair + `syncPending` drain), driven by a free daily GitHub Actions cron that also keeps the Render free-tier instance warm.

## What Was Built

### Task 1 — Reconcile endpoint (`api/routes/shopify.js`)
- `requireReconcileSecret` guard reads the `X-Reconcile-Secret` header and compares it to `process.env.SHOPIFY_RECONCILE_SECRET` with `crypto.timingSafeEqual` (length-guarded, never `===`). Missing header, unset server secret, length mismatch, or value mismatch → `401` with **zero Shopify work** (T-07-03 DoS mitigation).
- `POST /reconcile`:
  - Unconfigured Shopify → `200 { reconciled: 0, skipped: 'shopify-not-configured' }` (no crash, no sweep).
  - Otherwise loads `Product.find({ active: true })`; for each **active** variant that has a `shopifyInventoryItemId` OR is `syncPending`, calls `shopifyOutbound.syncInventoryOut(productId, variant.sku)` (absolute post-write count, D-06; best-effort, re-marks `syncPending` on failure, D-05).
  - Inactive variants skipped (D-15).
  - Returns `{ reconciled, syncPendingRetried, lastReconcileAt }` — the timestamp surfaces Pitfall 6 dormancy.
  - concerts.js try/catch/console.error/500 shape; a read failure returns `500`, not a crash.
- Commit: `6c6aeac`. RED test commit: `e7d127a`.

### Task 2 — Scheduled workflow (`.github/workflows/shopify-reconcile.yml`)
- `schedule: cron "0 6 * * *"` (daily, D-05 default, documented adjustable to weekly) + `workflow_dispatch` for manual runs.
- Single job runs `curl -fsS -X POST` to `${{ secrets.RECONCILE_URL }}/api/shopify/reconcile` with the `X-Reconcile-Secret: ${{ secrets.SHOPIFY_RECONCILE_SECRET }}` header. `-f` fails the step on non-2xx.
- No literal secret values — only `${{ secrets.* }}` references (T-07-02).
- Top comment documents required repo secrets (`RECONCILE_URL`, `SHOPIFY_RECONCILE_SECRET`), Pitfall 6 (60-day auto-disable) + cron-job.org fallback + `lastReconcileAt` visibility (T-07-14), and the Render keep-alive side effect.
- Commit: `b1d9933`.

## Verification

- `cd api && npx jest tests/shopifyReconcile.test.js` → 8 passed, exit 0.
- `cd api && npm test` full suite → **243 passed / 243** (was 235; +8 new reconcile tests). Green.
- Workflow file contains `schedule:`, `workflow_dispatch`, `/api/shopify/reconcile`, `X-Reconcile-Secret`, `curl -fsS`; secrets are `${{ secrets.* }}` references only.

## TDD Gate Compliance

- RED: `e7d127a` (`test(07-08)`) — tests failed (module not found) before implementation.
- GREEN: `6c6aeac` (`feat(07-08)`) — route added, all 8 tests pass.
- No REFACTOR commit needed (implementation clean on first pass).

## Deviations from Plan

None — plan executed exactly as written.

## Notes for Downstream Plans

- **07-10 (integration):** this router must be mounted in `api/index.js` at base path `/api/shopify` (the workflow POSTs `/api/shopify/reconcile`). Mounting/middleware ordering was intentionally NOT done here.
- Render service env must set `SHOPIFY_RECONCILE_SECRET` to the same value stored as the GitHub repo secret; repo secret `RECONCILE_URL` must be the Render API base URL (no trailing slash).

## Self-Check: PASSED

- FOUND: api/routes/shopify.js
- FOUND: api/tests/shopifyReconcile.test.js
- FOUND: .github/workflows/shopify-reconcile.yml
- FOUND commit e7d127a (test)
- FOUND commit 6c6aeac (feat route)
- FOUND commit b1d9933 (feat workflow)
