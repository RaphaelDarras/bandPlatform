---
phase: 04-showcase-website
plan: 05
subsystem: infra
tags: [vercel, ssg, vite-react-ssg, dns-cutover, github-pages-retirement, security, prerender, deploy]

# Dependency graph
requires:
  - phase: 04-showcase-website (04-01)
    provides: "Buildable web/ SSG app, vite-react-ssg build, BANDSINTOWN_APP_ID non-VITE_ env contract, .env.example"
  - phase: 04-showcase-website (04-02)
    provides: "app_id sanitized at the fetch boundary (static-loader-data JSON leak vector closed); flagged re-check against a real-key build"
  - phase: 04-showcase-website (04-03)
    provides: "Discography embeds (WEB-02)"
  - phase: 04-showcase-website (04-04)
    provides: "About/Contact/Stock routes (WEB-01/WEB-04) — full 6-route inventory"
provides:
  - "prerender-output build gate: automated assertion over dist that all 6 routes emit, concert data (or D-12 empty state) is baked in, and no app_id VALUE leaks into any dist HTML/JS/JSON"
  - "web/vercel.json (framework=vite, build/output config) for a Root Directory=web Vercel deploy"
  - "Live Vercel deployment of web/ at hurakanband.fr over HTTPS (apex A -> 76.76.21.21)"
  - "Legacy GitHub Pages deploy retired (D-04) and website/crowned/ deleted (D-05)"
affects: [phase-05-online-shop]

# Tech tracking
tech-stack:
  added:
    - "@types/node (web devDependency) — for the prerender test's node:fs/child_process/path imports"
  patterns:
    - "Build-output security gate: scan dist HTML/JS/JSON for the query-string pattern app_id=<value> (a real leak) rather than the bare token app_id (a false positive from clean()'s own searchParams.delete literal)"
    - "Self-sufficient dist assertion test: beforeAll builds dist if missing so the test passes regardless of test-vs-build call order"

key-files:
  created:
    - "web/src/test/prerender-output.test.ts"
    - "web/vercel.json"
  modified:
    - "web/package.json"
    - "web/tsconfig.json"
    - "web/.env.example"
  deleted:
    - ".github/workflows/deploy-website.yml"
    - "website/crowned/ (index.html + assets)"
    - "CNAME"

key-decisions:
  - "Refined the plan's naive `grep -r app_id dist` gate into an `app_id=<value>` query-string check: the bare token app_id legitimately appears in the client bundle as clean()'s own searchParams.delete('app_id') literal (documented in 04-02), so only a param-with-value is treated as a leak. HTML, JS, AND static-loader-data JSON are all scanned."
  - "Vercel Root Directory=web with framework=vite; buildCommand `npm run build` + outputDirectory `dist` — install runs from the monorepo root lockfile"
  - "Facebook domain-verification tag NOT re-homed before deleting crowned/ — user confirmed no more ads on the site, so verification serves no function (AEM retired 2025, campaign concluded). Resolves T-04-fbverify to 'not needed'."
  - "Root CNAME deleted (not left as stale artifact) — Vercel uses dashboard domain config, so the GitHub-Pages-only CNAME file is dead after cutover"

patterns-established:
  - "Security build gates distinguish a secret's VALUE from a sanitizer's harmless reference to the secret's parameter NAME"

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-04]

# Metrics
duration: "~2h (spanning human-gated deploy + DNS cutover)"
completed: 2026-07-03
---

# Phase 4 Plan 05: Prerender, Deploy & Legacy Retirement Summary

**Shipped Phase 4: added an automated prerender-output + app_id-leak build gate over all 6 routes, deployed the web/ SSG app to Vercel (Root Directory=web), cut hurakanband.fr over from GitHub Pages to Vercel over HTTPS, and retired the legacy GitHub Pages workflow + deleted website/crowned/ — making all four WEB requirements publicly live.**

## Performance

- **Duration:** ~2h wall-clock (dominated by the two human-gated steps: Vercel deploy + registrar DNS cutover/propagation). Automated executor work (Task 1 + Task 3 file changes) was a few minutes.
- **Completed:** 2026-07-03
- **Tasks:** 3 (1 auto, 1 human-verify gate, 1 human-action gate)
- **Files created/modified/deleted:** 2 created, 3 modified, 3 deleted

## Accomplishments

- **Task 1 (auto):** Created `web/src/test/prerender-output.test.ts` asserting over the built `dist/` that all 6 route HTML files exist (`index.html`, `discography/`, `concerts/`, `about/`, `contact/`, `stock/`), that `concerts/index.html` bakes in concert markup (a `<time datetime=...>` element) OR the D-12 empty-state copy `"No shows scheduled"` (proving the loader ran at build time, not a client placeholder), that no `app_id=<value>` leaks into any `.html`/`.js`/`.json` under `dist` (including the `static-loader-data/*.json` hydration files — the leak vector 04-02 found), and that every workspace `package.json` has a unique `name` (Vercel skip-unaffected requirement). Created `web/vercel.json` (framework=vite, build/output config). Full suite: **52/52 tests pass** (43 prior + 9 new); clean `npm run build -w web` prerenders all 6 routes.
- **Task 2 (human-verify gate — APPROVED):** User imported the Vercel project (Root Directory=web, Vite preset auto-detected), added `BANDSINTOWN_APP_ID` to Production + Preview + Development, deployed, and verified all 6 routes render correctly with no `app_id=<value>` leak in the deployed source. This is the first deploy with a REAL key, satisfying 04-02's deferred "re-check the leak assertion against a real-key build" flag.
- **Task 3 (human-action gate — CONFIRMED):** User repointed the `hurakanband.fr` apex `A` record from the GitHub Pages IPs to Vercel (`76.76.21.21`), verified `https://hurakanband.fr` serves the Vercel site over HTTPS, and disabled GitHub Pages. Executor then retired `.github/workflows/deploy-website.yml` (D-04), deleted `website/crowned/` (D-05), and deleted the stale root `CNAME`.

## Task Commits

1. **Task 1: prerender-output build gate + security assertion** — `7c6209c` (test)
2. **Task 1b (out-of-band during Task 2): remove `$comment` from vercel.json** — `a84dbd7` (fix) — applied by the orchestrator because Vercel's config schema rejects unknown keys; the operational notes were preserved as comments in `web/.env.example`.
3. **Task 3: retire GitHub Pages deploy + delete legacy crowned site** — `d35ca79` (chore)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified/Deleted

- **Created** `web/src/test/prerender-output.test.ts` — dist-output existence + baked-content + app_id-leak + unique-package-name assertions; self-sufficient `beforeAll` build.
- **Created** `web/vercel.json` — `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`.
- **Modified** `web/package.json` — added `@types/node` devDependency.
- **Modified** `web/tsconfig.json` — added `"node"` to `compilerOptions.types`.
- **Modified** `web/.env.example` — (via `a84dbd7`) absorbed the Root-Directory / non-VITE_ env-var operational notes that had been in vercel.json's rejected `$comment`.
- **Deleted** `.github/workflows/deploy-website.yml` (D-04) — the now-empty `.github/workflows/` dir was removed with it.
- **Deleted** `website/crowned/` (D-05) — 434 lines including the Meta pixel page and its FB domain-verification tag.
- **Deleted** `CNAME` — stale GitHub-Pages-only artifact.

## Decisions Made

- **app_id gate refined to `app_id=<value>`** — the plan's literal `grep -r app_id dist` would false-positive on `clean()`'s own `searchParams.delete('app_id')` bundled literal (a sanitizer, not a secret — documented in the 04-02 SUMMARY). The test treats only a query-param-with-value as a leak and scans HTML + JS + the `static-loader-data/*.json` hydration payloads.
- **FB domain-verification NOT re-homed** — user confirmed no ongoing ads; verification only serves ad/business functions (conversion tracking via the retired AEM, ad-link optimization, anti-spoofing). With the Crowned campaign concluded, the tag has no function, so it was allowed to lapse with `crowned/`. Resolves threat item T-04-fbverify.
- **Root CNAME deleted** rather than left as a harmless artifact — Vercel configures the domain via dashboard, not a repo CNAME file, so the file is dead post-cutover.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `@types/node` needed for the prerender test**
- **Found during:** Task 1
- **Issue:** `prerender-output.test.ts` uses `node:fs`, `node:child_process`, and `node:path`; the `web` workspace had no `@types/node`, so those imports would not type-check.
- **Fix:** Added `@types/node` as a `web` devDependency and `"node"` to `web/tsconfig.json` `compilerOptions.types`.
- **Files modified:** `web/package.json`, `web/tsconfig.json`
- **Committed in:** `7c6209c`

**2. [Rule 1 - Bug] Vercel rejects `$comment` in vercel.json** (applied out-of-band by the orchestrator during Task 2, folded into this plan)
- **Found during:** Task 2 (first Vercel deploy)
- **Issue:** The deploy failed with `Invalid request: should NOT have additional property $comment` — Vercel's config schema disallows unknown keys, so the documentation `$comment` I added in Task 1 broke the deploy.
- **Fix:** Removed the `$comment` key from `web/vercel.json` (leaving only `framework`/`buildCommand`/`outputDirectory`) and moved the operational notes (Root Directory=web, non-VITE_ env var) into comments in `web/.env.example`.
- **Files modified:** `web/vercel.json`, `web/.env.example`
- **Committed in:** `a84dbd7` (by orchestrator; pushed to origin/main)

### Refinements (not bugs)

- Tightened the plan's `grep -r app_id dist` acceptance check into an `app_id=<value>` scan (see Decisions) to avoid the known clean()-literal false positive while still catching a real secret leak — strengthens the T-04-cfg mitigation rather than changing scope.

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1 out-of-band), 1 gate-check refinement. No architectural changes; no scope creep.

## Issues Encountered

- The `$comment` key in `vercel.json` (added defensively in Task 1 to document dashboard requirements) is invalid per Vercel's config schema and broke the first deploy — resolved by moving the notes to `.env.example`. Lesson: Vercel config files reject unknown top-level keys; document operational context elsewhere.
- Pre-existing `web/tsconfig.json` project-reference error (TS6306/TS6310 re: `tsconfig.node.json` composite/emit settings) remains and is out of scope — it predates this plan (noted in the 04-04 SUMMARY) and does not affect the `vite-react-ssg build` pipeline, which has no `tsc --noEmit` gate.

## User Setup Required

None remaining for this plan — the site is live. Two content TODOs carried over from 04-04 (non-blocking) should still be filled before wide promotion:
- Real general + booking/press contact emails and Instagram handle in `web/src/pages/Contact.tsx` (currently `hi@`/`booking@` placeholders + generic Instagram URL), mirrored in `web/src/components/Footer.tsx`.

## Next Phase Readiness

- **Phase 4 is complete.** All four WEB requirements (WEB-01 bio, WEB-02 discography, WEB-03 concerts, WEB-04 contact) are publicly live at `https://hurakanband.fr` on Vercel, prerendered as static HTML with build-time Bandsintown data and no app_id leak.
- Legacy GitHub Pages path fully decommissioned (workflow retired, `crowned/` deleted, `CNAME` removed, Pages disabled by user).
- `web/index.html`, `website/stock/`, `website/fonts/`, `website/images/` still exist in the repo but are no longer deployed (the deploy workflow is gone); they can be pruned in a future cleanup if desired — left in place as they were not in this plan's scope (only D-05's `crowned/` deletion).
- Phase 5 (online shop) can build on the monorepo + `packages/shared` foundation and the live Vercel deployment.

## Threat Flags

None — no new security surface introduced. This plan closed T-04-cfg (app_id absent from live dist, verified against a real-key deploy), T-04-tls (HTTPS auto-provisioned by Vercel, confirmed on hurakanband.fr), and T-04-fbverify (re-homing determined not needed). T-04-downtime was an accepted risk (brief DNS propagation window).

## Self-Check: PASSED

- Created files verified present: `web/src/test/prerender-output.test.ts`, `web/vercel.json`.
- Deletions verified: `.github/workflows/deploy-website.yml`, `website/crowned/`, `CNAME` all absent from the working tree.
- Commits verified in git history: `7c6209c`, `a84dbd7`, `d35ca79`.
- Full test suite: 52/52 passing; `npm run build -w web` prerenders all 6 routes.

---
*Phase: 04-showcase-website*
*Completed: 2026-07-03*
