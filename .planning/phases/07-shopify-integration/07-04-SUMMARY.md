---
phase: 07-shopify-integration
plan: 04
subsystem: api
tags: [shopify, admin-api, graphql, oauth, client-credentials, hmac, webhooks, crypto, lazy-singleton]

# Dependency graph
requires:
  - phase: 07-01
    provides: "@shopify/admin-api-client@1.1.2 installed in the api workspace (CJS require, createAdminApiClient top-level export)"
  - phase: 07-02
    provides: "Product/Variant Shopify id fields (shopifyProductId, shopifyVariantId, shopifyInventoryItemId) the sync paths will read"
provides:
  - "shopifyTokenCache.getAccessToken: client-credentials token exchange + in-process cache/refresh"
  - "shopifyClient.shopifyRequest: single authenticated, error-surfacing Admin GraphQL entry point"
  - "shopifyWebhookAuth.verifyShopifyWebhook: timing-safe HMAC gate for inbound webhooks"
affects: [07-05, 07-06, shopifySync, shopifyWebhooks, shopify-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy-singleton external-API client: env read only inside function bodies, never at module load (boot-safe)"
    - "Self-refreshing OAuth token cache keyed off expires_in with a 5-minute proactive refresh margin"
    - "Timing-safe HMAC verification via crypto.timingSafeEqual with a length guard, never === on digests"

key-files:
  created:
    - api/services/shopifyTokenCache.js
    - api/services/shopifyClient.js
    - api/services/shopifyWebhookAuth.js
    - api/tests/shopifyClient.test.js
    - api/tests/shopifyWebhookAuth.test.js
  modified: []

key-decisions:
  - "Split the token cache into its own module (shopifyTokenCache.js) rather than inlining it in shopifyClient.js, so both the GraphQL client and any future direct-fetch path share one cache/refresh singleton"
  - "getAccessToken throws a single combined 'Shopify is not configured' error when any of SHOPIFY_SHOP_DOMAIN/CLIENT_ID/CLIENT_SECRET is missing (isShopifyConfigured-style guard, keyed off env presence, at call time only)"
  - "Refresh margin fixed at 5 minutes before the 86399s (~24h) expiry per RESEARCH Pattern 2"
  - "HMAC length guard returns false on mismatch/empty header instead of letting timingSafeEqual throw"

patterns-established:
  - "Lazy-singleton, boot-safe external service module mirroring stripeClient.js / paypalClient.js"
  - "Test strategy: real module + stubbed global fetch for the token cache; jest.doMock of @shopify/admin-api-client + ./shopifyTokenCache (with jest.resetModules) for the client wrapper"

requirements-completed: [SHOP-18, SHOP-19]

# Metrics
duration: ~20 min
completed: 2026-08-10
---

# Phase 07 Plan 04: Shopify Client + Token Cache + Webhook Auth Summary

**Three boot-safe Shopify plumbing modules: a self-refreshing client-credentials token cache, an authenticated Admin GraphQL request wrapper, and a timing-safe webhook HMAC verifier — all lazy-init so missing env vars never crash API boot.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T20:33Z
- **Completed:** 2026-08-10T20:53Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments
- `shopifyTokenCache.getAccessToken()` — exchanges `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` for a ~24h Admin API token via the client-credentials grant (`POST https://${SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`, url-encoded `grant_type=client_credentials`), caches `{ token, expiresAt }` in-process, and proactively re-fetches once within 5 minutes of expiry. Never caches a non-ok response.
- `shopifyClient.shopifyRequest(query, variables)` — the single authenticated entry point for all outbound GraphQL: calls `getAccessToken()`, builds `createAdminApiClient({ storeDomain, apiVersion, accessToken })`, runs `client.request(query, { variables })`, throws `Shopify GraphQL error: ...` when `errors` are present, returns `data` otherwise.
- `shopifyWebhookAuth.verifyShopifyWebhook(rawBodyBuffer, hmacHeader, clientSecret)` — computes `crypto.createHmac('sha256', clientSecret).update(raw).digest('base64')` and compares to the `X-Shopify-Hmac-SHA256` header with `crypto.timingSafeEqual`, guarding buffer lengths so a tampered/wrong-secret/empty/malformed header returns `false` and never throws.
- All three are lazy/boot-safe (env read only inside function bodies) and unit-tested; the full api suite stays green (188/188).

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Tasks 1 and 3):

1. **Task 1: shopifyTokenCache.js** — `e03abd0` (test, RED) → `44cc763` (feat, GREEN)
2. **Task 2: shopifyClient.js** — `b5a6398` (feat; extends the shared shopifyClient.test.js)
3. **Task 3: shopifyWebhookAuth.js** — `328028c` (test, RED) → `98c26b7` (feat, GREEN)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `api/services/shopifyTokenCache.js` — client-credentials token exchange + in-memory cache/refresh; exports `{ getAccessToken, _resetCache }`.
- `api/services/shopifyClient.js` — authenticated Admin GraphQL wrapper; exports `{ shopifyRequest }`.
- `api/services/shopifyWebhookAuth.js` — timing-safe HMAC verifier; exports `{ verifyShopifyWebhook }`.
- `api/tests/shopifyClient.test.js` — token-cache tests (real module + stubbed `fetch`) and client-wrapper tests (mocked `@shopify/admin-api-client` + `./shopifyTokenCache`). 9 tests.
- `api/tests/shopifyWebhookAuth.test.js` — valid/tampered/wrong-secret/empty/length-mismatch HMAC cases. 5 tests.

## Decisions Made
- Token cache lives in its own module so the client wrapper and any future direct-REST path share one refresh singleton.
- A single combined "Shopify is not configured" error at call time (never at require) for any missing env var, matching the `isShopifyConfigured`-style presence guard requested.
- No `SHOPIFY_ACCESS_TOKEN` reintroduced — the post-2026 client-credentials flow is the sole token source (D-16 intent, Pitfall 1).

## Deviations from Plan

None - plan executed exactly as written.

The plan named the token-cache module `shopifyTokenCache.js` in the task/artifact bodies while `files_modified` frontmatter used the same. The token-cache tests were placed in the shared `shopifyClient.test.js` exactly as Task 1/Task 2 specify, so no separate test file was needed.

## Issues Encountered
None. The pre-existing Mongoose "Duplicate schema index on {orderNumber:1}" warning surfaces during the full api run; it originates in the Order model (out of scope for this plan) and does not fail any test — left untouched per scope boundary.

## Threat Model Coverage
- **T-07-01 (Spoofing/Tampering):** `verifyShopifyWebhook` uses `crypto.timingSafeEqual` over the raw body; returns false on any mismatch. Ready for the 07-06 route handler to 401-and-touch-no-DB.
- **T-07-02 (Information Disclosure):** Client Secret and access token are read only inside function bodies, cached in memory, and never logged (verified: no `console.*` in the modules printing secrets).
- **T-07-09 (DoS via eager env check):** All three modules require() cleanly with no Shopify env set — verified by the boot-safe `node -e "require(...)"` check.

## User Setup Required
None in this plan. Live credentials (`SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_API_VERSION`) are handled by plan 07-01's user setup; this plan is built against the config-guarded no-op path and mocks all network in tests.

## Next Phase Readiness
- `shopifyRequest` is the ready-made entry point for the outbound sync service (productSet / inventorySetQuantities, 07-05).
- `verifyShopifyWebhook` is ready for the inbound webhook route (07-06) to call as the literal first statement before any DB access.
- No blockers.

## Self-Check: PASSED
- `api/services/shopifyTokenCache.js` — FOUND
- `api/services/shopifyClient.js` — FOUND
- `api/services/shopifyWebhookAuth.js` — FOUND
- `api/tests/shopifyClient.test.js` — FOUND
- `api/tests/shopifyWebhookAuth.test.js` — FOUND
- Commits e03abd0, 44cc763, b5a6398, 328028c, 98c26b7 — all present in git log
- Plan verification: `npx jest tests/shopifyClient.test.js tests/shopifyWebhookAuth.test.js` → 14/14 pass; boot-safe multi-require with no env → OK; full api suite → 188/188 pass

---
*Phase: 07-shopify-integration*
*Completed: 2026-08-10*
