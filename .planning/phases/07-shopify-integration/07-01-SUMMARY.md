---
phase: 07-shopify-integration
plan: 01
subsystem: infra
tags: [shopify, admin-api, dependency, env-config, supply-chain]

# Dependency graph
requires:
  - phase: 06-payments
    provides: ".env.example var-documentation convention (Stripe/PayPal/Resend sections)"
provides:
  - "@shopify/admin-api-client ^1.1.2 installed in the api workspace (CJS require()-able)"
  - "api/.env.example documents the six post-2026 Shopify client-credentials env vars"
affects: [shopify-token-cache, shopify-graphql-client, shopify-outbound-sync, shopify-webhook-handler]

# Tech tracking
tech-stack:
  added: ["@shopify/admin-api-client@1.1.2"]
  patterns: ["Post-2026 Shopify client-credentials flow (Client ID + Secret -> 24h token), no static Admin token"]

key-files:
  created: []
  modified: [api/package.json, api/.env.example]

key-decisions:
  - "Committed only api/package.json for the install: the root package-lock.json is gitignored (authoritative workspace lock) and the tracked api/package-lock.json is a stale pre-workspaces artifact npm no longer maintains — left untouched."
  - "Documented six SHOPIFY_* env vars using client-credentials flow; deliberately no SHOPIFY_ACCESS_TOKEN (retired pre-2026 static-token flow, RESEARCH Pitfall 1)."

patterns-established:
  - "Shopify credentials follow the client-credentials flow: SHOPIFY_CLIENT_SECRET doubles as the inbound-webhook HMAC key."

requirements-completed: [SHOP-18]

# Metrics
duration: ~4min
completed: 2026-08-10
---

# Phase 7 Plan 01: Shopify Dependency & Credentials Summary

**@shopify/admin-api-client@1.1.2 installed in the api workspace (CJS-verified, top-level `createAdminApiClient` export) and the six post-2026 client-credentials Shopify env vars documented in api/.env.example.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-10T20:21:24Z
- **Completed:** 2026-08-10T20:26:00Z
- **Tasks:** 3 (Task 1 checkpoint pre-approved by orchestrator)
- **Files modified:** 2

## Accomplishments
- Package-legitimacy checkpoint (Task 1, T-07-SC supply-chain trust boundary) treated as pre-approved per orchestrator instruction — the official `@shopify`-scope package was human-verified (v1.1.2, github.com/Shopify/shopify-app-js, 529k weekly downloads, @shopify.com maintainers).
- Installed `@shopify/admin-api-client` (resolved 1.1.2 — matches RESEARCH baseline and registry latest) in the api workspace via `npm install --workspace=api`.
- Confirmed CommonJS interop: `Object.keys(require('@shopify/admin-api-client'))` -> `['createAdminApiClient','createAdminRestApiClient']`; `createAdminApiClient` is a top-level function with no `.default` wrapper.
- Documented the six Shopify env vars in api/.env.example matching the existing Phase 6 comment/format style, with placeholders only.
- Left stripe / @paypal/paypal-server-sdk / resend in api/package.json (removed later in 07-10, not this plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy checkpoint** - pre-approved by orchestrator (no code change; gate recorded)
2. **Task 2: Install @shopify/admin-api-client in the api workspace** - `33045fe` (feat)
3. **Task 3: Document Shopify env vars in api/.env.example** - `959dab2` (docs)

## Files Created/Modified
- `api/package.json` - Added `@shopify/admin-api-client: ^1.1.2` to dependencies.
- `api/.env.example` - Added a "Shopify sync (Phase 7, D-16)" section with SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_API_VERSION, SHOPIFY_LOCATION_ID, SHOPIFY_RECONCILE_SECRET (placeholders only, no SHOPIFY_ACCESS_TOKEN).

## Decisions Made
- **Lockfile handling:** In this npm-workspaces monorepo the authoritative lockfile is the root `package-lock.json`, which is gitignored. The tracked `api/package-lock.json` is a stale pre-workspaces artifact that `npm install --workspace` does not update. Only `api/package.json` was committed for the install; neither lockfile was force-modified.
- **No static token:** Followed the post-2026 client-credentials flow (RESEARCH Pitfall 1) — no `SHOPIFY_ACCESS_TOKEN`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/Environmental] api/package-lock.json not committed as listed in files_modified**
- **Found during:** Task 2 (Install @shopify/admin-api-client)
- **Issue:** The plan frontmatter lists `api/package-lock.json` as a modified file, but `npm install --workspace=api` in this workspaces monorepo updates the root `package-lock.json` (which is gitignored), not the stale tracked `api/package-lock.json`. The api-level lockfile contains 0 references to the new package and was not touched by npm.
- **Fix:** Committed only `api/package.json`. Did not fabricate or hand-edit `api/package-lock.json`, and did not force the gitignored root lock into version control.
- **Files modified:** api/package.json (only)
- **Verification:** `git status` shows only api/package.json changed by the install; `npm view` and package-lock inspection both confirm 1.1.2 resolved.
- **Committed in:** 33045fe (Task 2 commit)

---

**Total deviations:** 1 (environmental — lockfile location under npm workspaces)
**Impact on plan:** No functional impact. Package is installed and require()-able; the plan's intent (dependency present in api workspace) is fully met.

## Issues Encountered
- `node -e "require('@shopify/admin-api-client/package.json')"` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` because the package's `exports` field blocks the `./package.json` subpath. This is expected behavior, not an error in our setup — version was confirmed via the root package-lock and `npm view` instead. The functional CJS interop check (`createAdminApiClient` is a function) exited 0.

## User Setup Required
**External services require manual configuration.** The Shopify custom app and store settings must be configured before any sync goes live (see the plan's `user_setup` block):
- Create the custom app in the Shopify Dev Dashboard with Admin API scopes (read/write products, read/write inventory, read orders, read locations), release a version, install on the store.
- Populate the six SHOPIFY_* env vars in the Render environment (real secrets never committed).
- Set store currency to EUR, disable tax collection, add "TVA non applicable, art. 293 B du CGI" mention (D-11).
- Delete the throwaway Shopify test product before the initial seed (D-09).

## Next Phase Readiness
- The runtime dependency and credential contract are in place for all downstream 07 sync plans (token cache, GraphQL client, outbound push, webhook handler).
- No blockers. Real Shopify credentials are not yet provisioned; downstream code is being built against the config-guarded no-op path.

## Self-Check: PASSED
- api/package.json — FOUND (contains @shopify/admin-api-client)
- api/.env.example — FOUND (6 SHOPIFY_* keys, no SHOPIFY_ACCESS_TOKEN)
- 07-01-SUMMARY.md — FOUND
- Commit 33045fe — FOUND
- Commit 959dab2 — FOUND
- api test suite: 16 suites / 173 tests passed

---
*Phase: 07-shopify-integration*
*Completed: 2026-08-10*
