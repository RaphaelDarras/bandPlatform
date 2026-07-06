# Deferred Items — Phase 06 (Payment Processing)

Items discovered during execution that are out of scope for the current plan (pre-existing,
unrelated to the task's file changes) per the executor's SCOPE BOUNDARY rule.

## 06-01: Pre-existing Concert schema migration test failures

**Found during:** Task 2 verification (`npm test --workspace=api` run as part of the plan's
own `<verification>` step: "npm test --workspace=api still green after install").

**Symptom:** 4 test suites fail with `ValidationError: Concert validation failed: city: Path
'city' is required., country: Path 'country' is required.` — `tests/concerts.test.js`,
`tests/products-put.test.js`, `tests/inventory.test.js`, `tests/models.test.js`.

**Root cause:** Pre-existing, already tracked in user memory
(`project_concert_schema_migration.md`): the Concert schema migration (remove `name`, add
`country`) is partially done — 2 files still need finishing. Test fixtures across the api
workspace still construct `Concert` documents without `city`/`country`, which the current
(migrated) schema now requires.

**Why out of scope for 06-01:** None of the four failing suites touch `stripe`,
`@paypal/paypal-server-sdk`, `resend`, or any file this plan modified
(`api/package.json`, `api/.env.example`, `api/tests/paypal-interop.test.js`). Confirmed
pre-existing by inspecting `api/package.json` history (the `test` script itself predates
this plan) and by the fact that these are Concert-fixture validation errors, structurally
unrelated to the newly-installed payment SDKs.

**Not fixed here.** Recommend finishing the Concert schema migration (the 2 remaining files
noted in `project_concert_schema_migration.md`) before or during a later Phase 6 plan that
touches these test files, or as a standalone fix.

## Environmental note (not a deviation)

`mongodb-memory-server`'s first-ever run on this machine downloads a ~700MB MongoDB binary
(`8.2.1`), which took ~14 minutes over this connection and caused spurious 5000ms hook
timeouts across `MongoMemoryServer.create()` in ALL suites during the very first
`npm test --workspace=api` invocation of this session. Once cached
(`~/.cache/mongodb-binaries/`), subsequent runs complete in ~4s. This is unrelated to
package installation and required no code fix — only a wait for the one-time download.
