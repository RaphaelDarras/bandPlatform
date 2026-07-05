---
phase: 05-online-shop-core
plan: 01
subsystem: api
tags: [typescript, vite, fetch, monorepo-types]

# Dependency graph
requires:
  - phase: 04-showcase-website
    provides: web/ Vite React SSG app shell, web/src/lib/bandsintown.ts client convention, existing packages/shared Concert type
provides:
  - "Product/Variant/OrderItem/Order TypeScript interfaces in @bandplatform/shared"
  - "Browser-only fetchProducts/fetchProduct/pingHealth client in web/src/lib/products.ts"
  - "VITE_API_URL documented in web/.env.example"
affects: [05-online-shop-core (catalog, detail, cart, checkout plans), 06-order-fulfillment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime (browser-only) fetch client mirrors Stock.tsx's res.ok error-throw shape, in contrast to bandsintown.ts's build-time-only SSR-guarded client"
    - "packages/shared stays type-only (no runtime code); doc comment above each interface cites its source Mongoose model"

key-files:
  created: [web/src/lib/products.ts]
  modified: [packages/shared/src/index.ts, web/.env.example, web/tsconfig.node.json]

key-decisions:
  - "id: string (not _id) used on Product to match Mongo ObjectId JSON serialization, consistent with existing Concert type"
  - "OrderItem/Order interfaces added now but explicitly marked Phase-6 forward-compat, not persisted this phase"
  - "products.ts has no build-time/SSR guard and no auth header — public runtime client, opposite constraints from bandsintown.ts"

patterns-established:
  - "Pattern: browser-only fetch client (fetch + res.ok throw), base URL from import.meta.env.VITE_<NAME> ?? '<render-fallback>' — reusable for cart/checkout API calls in later Phase 5 plans"

requirements-completed: [SHOP-01, SHOP-08, SHOP-13]

# Metrics
duration: ~10min
completed: 2026-07-05
---

# Phase 05 Plan 01: Shared Types + Products Fetch Client Summary

**Extended @bandplatform/shared with Product/Variant/OrderItem/Order types and created a browser-only fetchProducts/fetchProduct/pingHealth client against VITE_API_URL, mirroring Stock.tsx's runtime-fetch shape.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-05T19:58:05Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `packages/shared/src/index.ts` now exports 5 interfaces (Concert + Variant, Product, OrderItem, Order), type-only, mirroring `api/models/Product.js`/`api/models/Order.js` field-for-field
- `web/src/lib/products.ts` created: `fetchProducts()`, `fetchProduct(id)` (public GET endpoints, `res.ok`-throw error shape), and `pingHealth()` (fire-and-forget `/health` keep-alive, D-10)
- `web/.env.example` documents `VITE_API_URL` with the Vercel build-time-inlining/redeploy caveat
- Fixed a pre-existing broken TS project reference (`web/tsconfig.node.json` missing `composite: true`, incompatible with `noEmit: true`) that blocked the plan's mandated `npx tsc --noEmit -p web` verification command

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend @bandplatform/shared with Product/Variant/OrderItem/Order types** - `b456ad0` (feat)
2. **Task 2: Create browser-only products fetch client + document VITE_API_URL** - `77dca4c` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `packages/shared/src/index.ts` - Added Variant, Product, OrderItem, Order interfaces (type-only)
- `web/src/lib/products.ts` - New browser-only client: fetchProducts, fetchProduct, pingHealth
- `web/.env.example` - Documents VITE_API_URL with redeploy caveat
- `web/tsconfig.node.json` - Fixed composite/noEmit conflict (pre-existing bug, blocked verification)

## Decisions Made
- `id: string` (not `_id`) on `Product`, matching the existing `Concert` interface's convention for Mongo ObjectId JSON serialization
- `OrderItem`/`Order` doc comments explicitly flag Phase-6 forward-compat status — not persisted or used at runtime this phase
- No `import.meta.env.SSR` guard and no `Authorization` header in `products.ts` — this client is public and runs only in the browser, the opposite of `bandsintown.ts`'s build-time/secret-hiding constraints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed broken TS project reference in web/tsconfig.node.json**
- **Found during:** Task 2 verification (`npx tsc --noEmit -p web`)
- **Issue:** `web/tsconfig.node.json` had `noEmit: true` but was referenced from `web/tsconfig.json`'s `references` array without `composite: true`, causing TS6306 (`must have setting "composite": true`) and TS6310 (`may not disable emit`). This was a pre-existing bug from the Phase 4 scaffold (commit 079852c) — the plan's own mandated verification command for Task 2 (and implicitly any future `tsc -p web` run) could not execute at all.
- **Fix:** Added `"composite": true` and removed `"noEmit": true` from `web/tsconfig.node.json`. The `--noEmit` CLI flag on the invoking `tsc -p web` command still prevents any file emission; confirmed via `git status --short` that no build artifacts were generated.
- **Files modified:** `web/tsconfig.node.json`
- **Verification:** `npx tsc --noEmit -p web` now completes with no errors; re-ran after the fix and confirmed clean
- **Committed in:** `77dca4c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was required to run the plan's own mandated verification command; no scope creep — only touched compiler config, no behavior change to shipped code.

## Issues Encountered
- Initial doc comments in `products.ts` used the literal substrings `import.meta.env.SSR` and `Authorization` while explaining what NOT to do, which would have falsely tripped the acceptance criteria's negative grep checks (`does NOT contain import.meta.env.SSR or Authorization`). Reworded the comments to convey the same intent without those exact substrings; re-verified the negative greps pass.

## User Setup Required

None - no external service configuration required. `VITE_API_URL` has a working default (Render deployment URL); overriding it on Vercel is optional and documented in `web/.env.example`.

## Next Phase Readiness
- Downstream Phase 5 plans (catalog `Shop.tsx`, detail `ShopDetail.tsx`, cart, checkout) can now import `Product`/`Variant`/`OrderItem`/`Order` from `@bandplatform/shared` and call `fetchProducts`/`fetchProduct`/`pingHealth` from `web/src/lib/products.ts` directly — no further scaffolding needed for the type/data-fetch contract.
- No blockers identified for the next plan in wave 1/2.

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*
