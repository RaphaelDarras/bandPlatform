---
phase: 06-payment-processing
plan: 01
subsystem: payments
tags: [stripe, paypal, resend, npm, env-vars, cjs-interop]

# Dependency graph
requires:
  - phase: 05-online-shop-core
    provides: Product/Order models forward-compat fields, guest checkout form (Checkout.tsx), cart/catalog UI
provides:
  - stripe, @paypal/paypal-server-sdk, resend installed in api workspace
  - api/.env.example scaffold for all Phase 6 payment/email/web-origin secrets
  - Confirmed CJS require() access path for @paypal/paypal-server-sdk (Client, OrdersController, Environment, CheckoutPaymentIntent all resolve at the top level, no .default wrapper)
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-08]

# Tech tracking
tech-stack:
  added: ["stripe@^22.3.0", "@paypal/paypal-server-sdk@^2.4.0", "resend@^6.17.1"]
  patterns:
    - "Payment/email secrets declared server-side only in api/.env.example, never VITE_-prefixed"
    - "PayPal SDK required directly via require('@paypal/paypal-server-sdk') with no .default interop indirection"

key-files:
  created:
    - api/tests/paypal-interop.test.js
    - .planning/phases/06-payment-processing/deferred-items.md
  modified:
    - api/package.json
    - api/.env.example

key-decisions:
  - "Task 1 package-legitimacy checkpoint treated as pre-approved per orchestrator instruction (human already verified stripe/@paypal/paypal-server-sdk/resend on npmjs.com before this execution)"
  - "Fixed pre-existing Jest 30 CLI flag (--testPathPattern -> --testPathPatterns) in api/package.json test script — blocking issue for this plan's own 'npm test --workspace=api still green' verification requirement (Rule 3)"
  - "Deferred 4 pre-existing failing test suites (concerts.test.js, products-put.test.js, inventory.test.js, models.test.js) to deferred-items.md — Concert schema migration (city/country required) is a known partially-done migration unrelated to payment SDK installs"

patterns-established:
  - "require('@paypal/paypal-server-sdk') is the correct CJS access path — Client, OrdersController, Environment, CheckoutPaymentIntent are all named exports at the top level (verified via node -e and a dedicated interop test); no ESM .default wrapper needed. Plan 03 (PayPal client/order creation) should use this pattern directly."

requirements-completed: [SHOP-04, SHOP-05, SHOP-06]

# Metrics
duration: 30min (includes a one-time ~14min mongodb-memory-server binary download unrelated to this plan's work)
completed: 2026-07-06
---

# Phase 6 Plan 1: Payment SDK Install + PayPal CJS Interop Guard Summary

**Installed stripe/paypal-server-sdk/resend into the api workspace, scaffolded nine payment/email env vars in api/.env.example, and proved `require('@paypal/paypal-server-sdk')` resolves Client/OrdersController/Environment/CheckoutPaymentIntent directly with no ESM interop wrapper.**

## Performance

- **Duration:** ~30 min wall clock (includes a one-time ~14 min first-run download of the MongoDB test binary for `mongodb-memory-server`, unrelated to this plan's actual work)
- **Completed:** 2026-07-06T21:23:42Z
- **Tasks:** 3 (Task 1 checkpoint pre-approved, Tasks 2-3 executed)
- **Files modified:** 4 (2 modified: api/package.json, api/.env.example; 2 created: api/tests/paypal-interop.test.js, deferred-items.md)

## Accomplishments
- `stripe`, `@paypal/paypal-server-sdk`, `resend` installed into the `api` workspace at the exact versions RESEARCH verified (22.3.0, 2.4.0, 6.17.1 — resolved as `^` ranges)
- All nine Phase 6 env-var placeholders (Stripe, PayPal, Resend, web origin) added to `api/.env.example` with inline sourcing comments, zero VITE_-prefixed payment keys anywhere in the repo
- PayPal SDK CJS interop confirmed and locked in with a dedicated, network-free Jest test — de-risks RESEARCH Open Question 2 / Assumption A1 before Plan 03 writes the PayPal client

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy checkpoint** - pre-approved by human before this execution session (no commit; gating decision only, per orchestrator instruction)
2. **Task 2: Install SDKs + declare server-side env vars** - `c84f78b` (feat)
3. **Task 3: PayPal CJS interop guard test** - `bc21b1e` (test)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `api/package.json` - Added stripe, @paypal/paypal-server-sdk, resend dependencies; fixed pre-existing Jest 30 CLI flag in the `test` script
- `api/.env.example` - Added STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_ENV, RESEND_API_KEY, BAND_NOTIFICATION_EMAIL, WEB_BASE_URL
- `api/tests/paypal-interop.test.js` - CJS interop guard: require('@paypal/paypal-server-sdk') exposes Client, OrdersController, Environment, CheckoutPaymentIntent directly (no `.default`)
- `.planning/phases/06-payment-processing/deferred-items.md` - Logs pre-existing, out-of-scope Concert schema migration test failures discovered during verification

## Decisions Made
- Task 1's blocking human-verify checkpoint was honored as pre-approved per explicit orchestrator instruction (the human had already confirmed all three packages' legitimacy on npmjs.com in a prior session) — proceeded directly to install without re-prompting.
- Confirmed working PayPal require() access path (see `patterns-established` above) — recorded here for Plan 03 to consume directly, no `.default` indirection needed.
- **Did NOT mark SHOP-04/SHOP-05/SHOP-06 as Complete in REQUIREMENTS.md**, despite them being listed in this plan's frontmatter `requirements` field. This plan only installs SDKs and scaffolds env-var placeholders — no Stripe checkout, PayPal order flow, or email sending exists yet (that lands across Plans 02-08). Marking these Complete now would misrepresent project state. Recommend the final Phase 6 plan that actually delivers each capability call `requirements mark-complete` for it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing Jest 30 CLI flag in api/package.json test script**
- **Found during:** Task 2 verification (`npm test --workspace=api` required by the plan's own `<verification>` section)
- **Issue:** `api/package.json`'s `test` script used `jest --testPathPattern=tests/`, a flag Jest 30 removed in favor of `--testPathPatterns`. This predates this plan (confirmed via `git show HEAD:api/package.json` before any changes) but blocked running the plan's own verification step and Task 3's test command.
- **Fix:** Changed `--testPathPattern=tests/` to `--testPathPatterns=tests/` in `api/package.json`.
- **Files modified:** `api/package.json`
- **Verification:** `npm test --workspace=api` now runs (previously errored immediately with a CLI usage error before running any tests).
- **Committed in:** `c84f78b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock the plan's own verification requirement. No scope creep — only the single deprecated CLI flag was touched, not the underlying test logic.

## Issues Encountered

- **First-run `mongodb-memory-server` binary download (environmental, not a deviation):** the very first `npm test --workspace=api` invocation in this session triggered a ~700MB, ~14-minute download of the MongoDB 8.2.1 test binary (this machine had no prior cache). This caused every `MongoMemoryServer.create()` call across all test suites to exceed Jest's default 5000ms hook timeout on the first run. Once cached (`~/.cache/mongodb-binaries/`), subsequent runs completed in ~4s. No code change was needed — just waiting for the one-time download. Documented in `deferred-items.md` for future executors on fresh machines.
- **4 pre-existing failing test suites unrelated to this plan** (`concerts.test.js`, `products-put.test.js`, `inventory.test.js`, `models.test.js`): all fail with `Concert validation failed: city/country required` — a known, already-tracked, partially-done Concert schema migration (per user memory `project_concert_schema_migration.md`), not touched by this plan's files. Logged to `deferred-items.md`, not fixed here per SCOPE BOUNDARY (out of scope — no relation to stripe/paypal/resend or the files this plan modifies).

## User Setup Required

None for this plan specifically — the `user_setup` block in `06-01-PLAN.md` frontmatter (Stripe/PayPal/Resend account creation, DNS domain verification) describes account-level setup the user needs to complete before Plan 02+ can be tested end-to-end, but no code in this plan depends on real credentials yet (env vars are placeholders only). The user should:
1. Create a Stripe account (TEST mode) and obtain `STRIPE_SECRET_KEY`.
2. Create a PayPal Developer sandbox app and obtain `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`.
3. Sign up for Resend and start `hurakanband.fr` domain verification NOW (DNS propagation can take up to 24h).

## Next Phase Readiness
- Plan 02+ can now `require('stripe')`, `require('@paypal/paypal-server-sdk')`, `require('resend')` from any `api/` file.
- Plan 03 (PayPal client/order creation) has a confirmed, tested require() access path — no interop surprises expected.
- Real credentials (Stripe/PayPal/Resend) still need to be obtained by the user and placed in `api/.env` (not `.env.example`) before webhook/email plans can be tested against live sandboxes.
- Pre-existing Concert schema migration test failures remain open (tracked in `deferred-items.md` and user memory) — should be resolved before or during whichever later Phase 6 plan next touches `concerts.test.js`/`models.test.js`/`products-put.test.js`/`inventory.test.js`.

---
*Phase: 06-payment-processing*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: api/tests/paypal-interop.test.js
- FOUND: api/package.json contains @paypal/paypal-server-sdk
- FOUND: .planning/phases/06-payment-processing/deferred-items.md
- FOUND commit c84f78b (Task 2: feat)
- FOUND commit bc21b1e (Task 3: test)
- FOUND commit 5ee0bd5 (docs: SUMMARY)
