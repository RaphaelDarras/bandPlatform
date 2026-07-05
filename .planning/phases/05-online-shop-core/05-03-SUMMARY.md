---
phase: 05-online-shop-core
plan: 03
subsystem: infra
tags: [express, meta-capi, cleanup, credential-hygiene, react, vitest]

# Dependency graph
requires: []
provides:
  - Meta Pixel / Conversions API route, mount, and repo credentials fully removed (D-27)
  - D-15 divergence note anchoring Stock.tsx's <= 5 threshold to the shop's < 5 threshold
affects: [05-04, 05-05, future-shop-plans-touching-StockBadge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decision-ID cross-reference comments for intentional divergence (D-15 style, mirrors bandsintown.ts D-09 convention)"

key-files:
  created: []
  modified:
    - api/index.js
    - api/.env.example
    - web/src/pages/Stock.tsx

key-decisions:
  - "D-27 executed exactly as scoped: delete capi.js, remove its mount, remove 3 META_* vars from api/.env.example — no other repo files touched"
  - "Stock.tsx threshold left at <= 5 per D-15 (deliberately divergent from the future shop StockBadge's < 5), annotated rather than changed"

patterns-established: []

requirements-completed: [SHOP-13]

# Metrics
duration: 6min
completed: 2026-07-05
---

# Phase 5 Plan 3: Meta CAPI Removal + Stock.tsx D-15 Annotation Summary

**Deleted the Meta Conversions API route/mount/credentials (D-27) and anchored Stock.tsx's intentional `<= 5` low-stock threshold to CONTEXT.md D-15 with a cross-reference comment.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-05T22:06:00Z
- **Completed:** 2026-07-05T22:12:19Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 deleted, 2 modified)

## Accomplishments
- Fully removed the defunct Meta Pixel / Conversions API advertising infrastructure from the repo: `api/routes/capi.js` deleted, `/api/capi` mount removed from `api/index.js`, and the three `META_*` vars (plus their comment header) removed from `api/.env.example`
- Verified no dangling `require('./routes/capi')` references remain anywhere under `api/` and that `api/index.js` still passes a syntax check after the edit
- Annotated `Stock.tsx`'s `stockColorClass` with a D-15 cross-reference comment documenting the intentional `<= 5` (admin) vs `< 5` (shop `StockBadge`) threshold divergence, without changing the threshold logic itself
- Confirmed the existing `Stock.test.tsx` suite (3 tests) still passes after the annotation

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Meta Pixel / CAPI advertising infrastructure (D-27)** - `d4cbf87` (fix)
2. **Task 2: Annotate Stock.tsx stockColorClass with the D-15 divergence note** - `4e9b13d` (docs)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `api/routes/capi.js` - Deleted (Meta Conversions API route, no replacement)
- `api/index.js` - Removed the `app.use('/api/capi', require('./routes/capi'));` mount line; all other route mounts (auth, products, inventory, concerts, sales) untouched
- `api/.env.example` - Removed `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE` and their comment header; file now ends cleanly after `NODE_ENV=development`
- `web/src/pages/Stock.tsx` - Added a 4-line comment above `stockColorClass` cross-referencing D-15 and the future `StockBadge` component's differing threshold; threshold logic (`<= 5`) unchanged

## Decisions Made
- Followed D-27's exact 3-file scope from PATTERNS.md — no broader search for Meta/ad-tracking code was needed since CONTEXT.md and PATTERNS.md had already verified `web/` contains no pixel code
- Kept the D-15 comment forward-referencing `web/src/components/StockBadge.tsx` even though that file does not exist yet in this repo state — it is planned in a later Phase 5 wave (per 05-PATTERNS.md), and the comment's purpose (preventing a future "fix" of the divergence) holds regardless of build order

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

**Manual action required — cannot be automated from this repo:**

- [ ] Log into the Render dashboard → `hurakan-band-platform` service → Environment
- [ ] Delete the `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, and `META_CAPI_TEST_EVENT_CODE` environment variables
- [ ] Verify the service redeploys/restarts cleanly with those vars removed (the app never referenced them outside the now-deleted `capi.js`, so no functional impact is expected)

This closes threat T-5-03 (stale ad-tracking credential in the live Render env store) once completed. The repo-side mitigation (removing `META_*` from `api/.env.example` and deleting the route that consumed them) is already committed.

## Next Phase Readiness
- D-27 cleanup fully closed on the repo side; only the external Render dashboard step remains (tracked above, not blocking further Phase 5 work)
- D-15 divergence is now documented on both sides once `StockBadge.tsx` is built in a later Phase 5 plan — that plan's PATTERNS.md excerpt already specifies the matching comment to add there
- No blockers for subsequent Phase 5 plans (shop catalog/cart/checkout work is fully independent of this plan, as designed)

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*
