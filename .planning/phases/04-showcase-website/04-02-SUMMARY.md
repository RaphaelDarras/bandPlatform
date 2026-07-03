---
phase: 04-showcase-website
plan: 02
subsystem: ui
tags: [bandsintown, react, vite-react-ssg, vitest, testing-library, ssg]

# Dependency graph
requires:
  - phase: 04-showcase-website (Plan 04-01)
    provides: "web/ app shell, BitEvent/fetchUpcomingEvents build-time contract stub, App.tsx loaders, Layout/Header/Footer, Home/Concerts stub pages"
provides:
  - "Verified Bandsintown client (clean, nextEvent, venueDisplay) with fixture-driven parse test"
  - "app_id sanitization at the fetch boundary (sanitizeEvent) — not just at render sites"
  - "ConcertList component: event rows + D-12 empty state"
  - "Concerts page wired to ConcertList via build-time loader"
  - "Home page hero + next-concert teaser + latest-release teaser (D-25)"
affects: [04-03-discography, 04-05-prerender-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sanitize external-data URLs at the fetch/loader boundary, not only at JSX render sites, so hydration payloads never carry secrets"
    - "venueDisplay() mitigates the Bandsintown festival venue.name===title quirk by preferring venue.location + title"

key-files:
  created:
    - "web/src/lib/__fixtures__/bandsintown-events.json"
    - "web/src/lib/bandsintown.test.ts"
    - "web/src/components/ConcertList.tsx"
    - "web/src/components/ConcertList.test.tsx"
    - "web/src/pages/Concerts.test.tsx"
    - "web/src/pages/Home.test.tsx"
  modified:
    - "web/src/lib/bandsintown.ts"
    - "web/src/pages/Concerts.tsx"
    - "web/src/pages/Home.tsx"

key-decisions:
  - "app_id stripped inside fetchUpcomingEvents (sanitizeEvent) before the loader result is returned, not only at ConcertList/Home render call sites — the raw loader return value is what vite-react-ssg serializes into the static-loader-data JSON used for client hydration, so render-only cleaning would still leak the secret in that JSON"
  - "venueDisplay() centralizes the festival venue.name===title mitigation so Concerts, ConcertList, and Home all display 'location — title' consistently instead of the misleading bare venue.name"
  - "nextEvent() extracted as a pure helper (events[0] ?? null) so Home and Concerts share identical 'next upcoming event' semantics"

patterns-established:
  - "External-data secret stripping belongs at the data-fetch boundary (source of truth), with render-site stripping kept only as defense-in-depth"

requirements-completed: [WEB-03]

# Metrics
duration: 10min
completed: 2026-07-03
---

# Phase 4 Plan 02: Concerts + Home Summary

**Bandsintown build-time client finalized (clean/nextEvent/venueDisplay) with fixture-driven tests, ConcertList + Concerts page rendering WEB-03 with the D-12 empty state, and Home's hero/next-concert/latest-release teaser — plus a fetch-boundary fix that strips app_id before it reaches the SSG hydration payload, not just the rendered HTML.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-03T12:24:57Z
- **Completed:** 2026-07-03T12:34:40Z
- **Tasks:** 3 (all TDD: RED → GREEN per task, plus one follow-up security fix)
- **Files modified/created:** 9

## Accomplishments
- Finalized `web/src/lib/bandsintown.ts`: added `nextEvent()` and `venueDisplay()`, added a warning log on fetch failure/non-ok response (fail-soft convention), and created a 2-event fixture (festival with `venue.name === title` quirk + normal venue, one with offers/app_id, one without) with a fully passing `bandsintown.test.ts`.
- Built `ConcertList.tsx`: renders the D-12 empty state ("No shows scheduled" + follow-Bandsintown CTA) and, when populated, event rows with date/venue/city/country and a "Get Tickets" link only when `offers` is non-empty, app_id stripped.
- Wired `Concerts.tsx` to delegate to `ConcertList` behind a `useLoaderData()` read, with an "Upcoming Shows" heading.
- Built out `Home.tsx`: hero wordmark + "Listen Now" CTA to `/discography`, a next-concert teaser built from `nextEvent()`/`venueDisplay()` with a "Get Tickets" link when offers exist (degrading to a compact "No shows scheduled" line linking to `/concerts` when empty), and a latest-release teaser linking to `/discography`. No merch teaser (D-25/Phase 5 scope).
- **Found and fixed a real D-09 gap**: the plan's `clean()` calls at JSX render sites don't protect the *data* baked into vite-react-ssg's static-loader-data JSON (used for client hydration) — only the rendered HTML. Moved app_id stripping into `fetchUpcomingEvents` itself (`sanitizeEvent`) so the returned `BitEvent[]` never carries the secret in `url`/`offers[].url`, closing the gap at its true source.
- Full Vitest suite green (24/24 across 5 files); `npm run build -w web` succeeds; the only "app_id" string remaining in the client bundle is the literal query-param name inside `clean()`'s own `searchParams.delete('app_id')` call — not a secret value.

## Task Commits

Each task followed RED → GREEN:

1. **Task 1: Verified Bandsintown client + fixture parse test**
   - `54e55fe` (test — RED: fixture + failing assertions for `nextEvent`/`venueDisplay`)
   - `d09858c` (feat — GREEN: `nextEvent`, `venueDisplay`, fail-soft warning logs)
2. **Task 2: ConcertList + Concerts page (WEB-03, D-12)**
   - `b0961c1` (test — RED: `ConcertList.test.tsx` + `Concerts.test.tsx`)
   - `0939861` (feat — GREEN: `ConcertList.tsx` built, `Concerts.tsx` wired)
3. **Task 3: Home hero + teasers (D-25)**
   - `6231cec` (test — RED: Get Tickets + release-teaser assertions)
   - `f9f8ed5` (feat — GREEN: full `Home.tsx` hero/teaser implementation)
4. **Follow-up security fix** (discovered during Task 3 build verification, applies to Task 1's file)
   - `93da59e` (fix — `sanitizeEvent` strips app_id at the fetch boundary)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `web/src/lib/bandsintown.ts` — added `nextEvent()`, `venueDisplay()`, warning logs on fetch failure, and `sanitizeEvent()` applied inside `fetchUpcomingEvents` before returning
- `web/src/lib/bandsintown.test.ts` — fixture parse assertions, `clean()` app_id stripping (incl. against fixture URLs), `venueDisplay()` festival-quirk + normal-venue cases, `nextEvent()` first/empty cases, fail-soft fetch behavior
- `web/src/lib/__fixtures__/bandsintown-events.json` — 2-event fixture: festival (`venue.name === title`, has offers with app_id) + normal venue (no offers, clean top-level url)
- `web/src/components/ConcertList.tsx` — event rows + D-12 empty state, "Get Tickets" gated on non-empty offers
- `web/src/components/ConcertList.test.tsx` — empty-state copy/link, venue/city/country rendering, Get Tickets link count + app_id absence
- `web/src/pages/Concerts.tsx` — delegates to `ConcertList`, "Upcoming Shows" heading
- `web/src/pages/Concerts.test.tsx` — heading + event rows via mocked `useLoaderData`
- `web/src/pages/Home.tsx` — hero, next-concert teaser (`nextEvent`/`venueDisplay`/`clean`), latest-release teaser
- `web/src/pages/Home.test.tsx` — Listen Now href, next-event venue text, empty-state fallback, no-merch assertion, Get Tickets link, release-teaser link

## Decisions Made
- **app_id stripped at the fetch boundary, not just render sites** — see Deviations below; this is the single most consequential decision in this plan.
- **`venueDisplay()` as a shared helper** rather than inlining the festival-quirk check in three places (ConcertList, Home) — keeps the mitigation in one tested location.
- **`nextEvent()` extracted as a pure function** so Home and Concerts agree on "next event" semantics without duplicating `events[0] ?? null` logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] app_id leaked into SSG hydration data despite render-site `clean()` calls**
- **Found during:** Task 3 (post-implementation `npm run build -w web` verification)
- **Issue:** The plan's `clean()` calls in `ConcertList.tsx`/`Home.tsx` only sanitize what gets rendered into JSX. `vite-react-ssg` serializes the *raw loader return value* (`{ events: await fetchUpcomingEvents() }`) into a `static-loader-data/*.json` file shipped to the browser for React Router hydration. Since `fetchUpcomingEvents()` returned events with app_id still embedded in `url`/`offers[].url`, that raw secret-laden data would ship in the hydration JSON in production (when a real `BANDSINTOWN_APP_ID` is configured) — a real D-09/T-04-cfg violation invisible to a `grep app_id dist/**/*.html` check, since the HTML itself looks clean.
- **Fix:** Added `sanitizeEvent()` inside `bandsintown.ts`, applied to every event before `fetchUpcomingEvents` returns. `BitEvent[]` now never carries app_id in any URL field once fetched — the loader's raw output is clean at the source. Render-site `clean()` calls remain as defense-in-depth (also handles any other Bandsintown-attribution query params that might appear later).
- **Files modified:** `web/src/lib/bandsintown.ts`
- **Verification:** Full Vitest suite green (24/24); `npm run build -w web` succeeds; `grep -c app_id dist/assets/app-*.js` returns 1, and that occurrence is confirmed (via `grep -o` context extraction) to be `clean()`'s own `searchParams.delete("app_id")` literal, not a secret value. Could not verify end-to-end with a real `BANDSINTOWN_APP_ID` in this environment (no key available/no network fetch exercised in the sandboxed build) — flagged for the manual live-verification step already planned for Plan 04-05.
- **Committed in:** `93da59e`

---

**Total deviations:** 1 auto-fixed (Rule 1 — security-relevant bug affecting D-09/T-04-cfg).
**Impact on plan:** Strengthens the plan's own stated threat mitigation (T-04-cfg) rather than changing scope. No architectural changes; no scope creep.

## Issues Encountered
- `import.meta.env.SSR` evaluates to `false` under the current Vitest jsdom config, so the network-fetch branch of `fetchUpcomingEvents()` (and therefore `sanitizeEvent`) cannot be exercised by a unit test in this environment — the existing "returns [] when app_id unset" test only proves the fail-soft guard, not the sanitize-on-success path. This is consistent with the plan's own note that live-payload verification is a Manual-Only step (04-VALIDATION.md) — flagging here so Plan 04-05's build/deploy verification explicitly re-checks `grep -r app_id dist` against a build with a real `BANDSINTOWN_APP_ID` set.

## User Setup Required
None — no new external service configuration required by this plan. (The `BANDSINTOWN_APP_ID` Vercel env var requirement was already documented in Plan 04-01's summary and remains a Plan 04-05 deploy-time task.)

## Next Phase Readiness
- WEB-03 is satisfied: `/concerts` renders build-time Bandsintown events with venue/city/country/date, a "Get Tickets" link when offers exist, and the D-12 empty state; Home shows the next-concert teaser + "Listen Now" CTA + latest-release teaser.
- `venueDisplay`, `nextEvent`, and `clean` are all exported from `web/src/lib/bandsintown.ts` and available for reuse (e.g., if Plan 04-03's Discography teaser or Plan 04-05's verification needs them).
- Plan 04-05 should include an explicit `grep -r app_id dist` check against a build run with a real (test) `BANDSINTOWN_APP_ID`, covering both the rendered HTML *and* the `static-loader-data/*.json` files, given the gap found and fixed in this plan.
- No blockers for Plan 04-03 (Discography) or Plan 04-04 (About/Contact) — both are independent of this plan's files.

## Self-Check: PASSED

All 9 created/modified files verified present on disk; all 7 commits (`54e55fe`, `d09858c`, `b0961c1`, `0939861`, `6231cec`, `f9f8ed5`, `93da59e`) verified in git history via `git log --oneline`.

---
*Phase: 04-showcase-website*
*Completed: 2026-07-03*
