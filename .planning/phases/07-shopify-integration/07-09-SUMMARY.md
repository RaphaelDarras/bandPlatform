---
phase: 07-shopify-integration
plan: 09
subsystem: infra
tags: [shopify, ops-scripts, webhooks, graphql, documentation, seed]

# Dependency graph
requires:
  - phase: 07-05
    provides: shopifySync.pushProduct / pushInventory outbound engine
  - phase: 07-06
    provides: inbound webhook routes + D-07 topic set (/api/shopify/webhooks/*)
provides:
  - One-time Mongo->Shopify seed script (seedShopify.js) with id capture (D-08/D-09)
  - One-time location query + idempotent webhook registration script (shopifySetup.js)
  - SHOP-19 conflict-resolution documentation + operator go-live runbook (docs/shopify-sync.md)
affects: [shopify-golive, 07-reconcile, operator-runbook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-time ops scripts mirror utils/seedAdmin.js boilerplate (dotenv + async main + explicit exit)"
    - "Scripts fail loudly on missing env vars before any write (no partial exports)"
    - "Idempotent Shopify writes: seed skips linked products; setup skips existing same-URI subscriptions"

key-files:
  created:
    - api/scripts/seedShopify.js
    - api/scripts/shopifySetup.js
    - docs/shopify-sync.md
  modified:
    - api/package.json
    - api/.env.example

key-decisions:
  - "Added SHOPIFY_WEBHOOK_BASE_URL env var (API/Render host) to build webhook callback URLs; documented as placeholder in .env.example"
  - "SKU bootstrap matching kept inline in seedShopify.js (not a shared helper) per Pitfall 5"
  - "INVENTORY_LEVELS_UPDATE deliberately excluded from webhook registration (Pitfall 3 feedback loop)"

patterns-established:
  - "Ops scripts validate a REQUIRED_ENV list and throw a clear message before connecting/writing"
  - "Idempotency via pre-query (existing webhookSubscriptions) + skip-if-linked (shopifyProductId)"

requirements-completed: [SHOP-18, SHOP-19]

# Metrics
duration: 18min
completed: 2026-08-10
---

# Phase 7 Plan 09: Shopify Go-Live Ops Scripts & Conflict Docs Summary

**One-time Mongo->Shopify seed with id capture, idempotent webhook/location setup script (six D-07 topics, no INVENTORY_LEVELS_UPDATE), and the SHOP-19 conflict-resolution runbook.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-10
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `api/scripts/seedShopify.js` — exports active Mongo products to Shopify via `shopifySync.pushProduct`, captures `shopifyProductId` + per-variant `shopifyVariantId`/`shopifyInventoryItemId` back onto the Mongo docs (D-08), then sets Shopify stock from Mongo's absolute count (D-01/D-06). Idempotent (skips already-linked products), inline SKU bootstrap matching (Pitfall 5), fails loudly if unconfigured.
- `api/scripts/shopifySetup.js` — queries `locations(first:5)` so the operator can pin `SHOPIFY_LOCATION_ID` (D-16), then idempotently registers exactly the six D-07 topics via `webhookSubscriptionCreate` (pre-queries existing subscriptions and skips same-URI matches, T-07-15). Never registers `INVENTORY_LEVELS_UPDATE` (Pitfall 3/T-07-11).
- `docs/shopify-sync.md` — SHOP-19 conflict rules (inventory=Mongo, content=Shopify, oversell stance, price split, image overwrite, soft-delete lifecycle, EUR/VAT manual), the deliberate INVENTORY_LEVELS_UPDATE gap, a per-field authority table, and a full operator go-live runbook.

## Task Commits

Each task committed atomically:

1. **Task 1: seedShopify.js one-time export with id capture** - `b87ed5f` (feat)
2. **Task 2: shopifySetup.js location query + idempotent webhook registration** - `3bd30e3` (feat)
3. **Task 3: SHOP-19 conflict-resolution documentation** - `6577022` (docs)

**Plan metadata:** (this SUMMARY commit — orchestrator handles STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `api/scripts/seedShopify.js` - One-time Mongo->Shopify catalog export + id capture + stock seed
- `api/scripts/shopifySetup.js` - Location query + idempotent D-07 webhook registration
- `docs/shopify-sync.md` - SHOP-19 conflict-resolution rules + per-field authority table + operator runbook
- `api/package.json` - Added `seed:shopify` and `shopify:setup` npm scripts (additive; existing scripts untouched)
- `api/.env.example` - Added `SHOPIFY_WEBHOOK_BASE_URL` placeholder for webhook callback URLs

## Decisions Made
- **SHOPIFY_WEBHOOK_BASE_URL:** shopifySetup.js needs the public API host to build the six `/api/shopify/webhooks/{topic}` callback URLs. Added it as a required env var (script fails loudly if unset) and documented it as a placeholder in `api/.env.example`.
- **Inline SKU matching:** seed id capture matches the Shopify create response to Mongo variants by SKU inline (not via a shared helper) per Pitfall 5 — steady-state matching is id-first and must not couple to bootstrap matching.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added SHOPIFY_WEBHOOK_BASE_URL to .env.example**
- **Found during:** Task 2 (shopifySetup.js)
- **Issue:** The script must build inbound webhook callback URLs from the API's public host; no existing env var carried the API/Render base URL (WEB_BASE_URL is the frontend origin). Without documentation an operator could not run `shopify:setup`.
- **Fix:** Added `SHOPIFY_WEBHOOK_BASE_URL` as a required env var (script asserts it and fails loudly) and documented it as a placeholder in `api/.env.example` (`.env.example` was not in the plan's files_modified list).
- **Files modified:** api/scripts/shopifySetup.js, api/.env.example
- **Verification:** node -c passes; script asserts the var and throws a clear message if missing; placeholder contains no secret.
- **Committed in:** 3bd30e3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical config)
**Impact on plan:** Necessary for the setup script to be runnable and documented. No scope creep — additive env var placeholder only, no secrets.

## Issues Encountered
None. All three `<verify>` blocks passed on first run; full api suite stayed green at 243/243 (scripts are one-time CLI tools, not imported by the app — no runtime impact). Pre-existing Mongoose "duplicate index on orderNumber" warnings are unrelated to this plan.

## User Setup Required
This plan produces the one-time go-live scripts an operator runs manually against the live store (see plan `user_setup` and `docs/shopify-sync.md`):
1. Delete the throwaway Shopify test product by hand (D-09) BEFORE seeding.
2. `npm run shopify:setup --workspace=api` — pin location + register webhooks.
3. `npm run seed:shopify --workspace=api` — export catalog + capture ids.

## Next Phase Readiness
- Go-live tooling and conflict documentation complete. Ready for the remaining Wave 5 wiring (e.g., mounting shopifyWebhooks in index.js, plan 07-10) and the reconcile backstop.
- No blockers.

## Self-Check: PASSED

---
*Phase: 07-shopify-integration*
*Completed: 2026-08-10*
