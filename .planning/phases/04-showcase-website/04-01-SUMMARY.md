---
phase: 04-showcase-website
plan: 01
subsystem: infra
tags: [monorepo, npm-workspaces, vite, react19, vite-react-ssg, tailwind-v4, vitest, bandsintown, ssg]

# Dependency graph
requires:
  - phase: 02-mobile-pos-core
    provides: "Concert type shape (mobile/src/api/concerts.ts) mirrored into packages/shared"
provides:
  - "npm-workspaces monorepo root spanning web/mobile/api/packages/* (D-06)"
  - "packages/shared type-only Concert skeleton for Phase 5 reuse"
  - "Buildable web/ app: Vite 7 + React 19 + TS + Tailwind v4 + vite-react-ssg (SSG)"
  - "Vitest test framework for web/ (jsdom + testing-library)"
  - "BitEvent / fetchUpcomingEvents build-time data contract (web/src/lib/bandsintown.ts)"
  - "Release union type + releases[] config (web/src/data/releases.ts)"
  - "vite-react-ssg RouteRecord tree for all 5 routes + /stock + 404"
  - "Tailwind v4 CSS-first @theme with UI-SPEC tokens + Bebas Neue/Inter"
  - "App shell: Layout/Header (3-link nav + hamburger)/Footer"
affects: [04-02-concerts, 04-03-discography, 04-04-about-contact, 04-05-prerender-deploy, phase-05-online-shop]

# Tech tracking
tech-stack:
  added:
    - "vite@7.3.6, vite-react-ssg@0.9.0, @vitejs/plugin-react@5.1.4"
    - "react@19 / react-dom@19, react-router-dom@6"
    - "tailwindcss@4.3.2 + @tailwindcss/vite@4.3.2 (CSS-first)"
    - "vitest + @testing-library/react + @testing-library/jest-dom + jsdom"
    - "@fontsource/bebas-neue, @fontsource/inter"
  patterns:
    - "SSG entry via ViteReactSSG({ routes }); build-time loaders bake concert data into HTML"
    - "Build-time-only data guarded by import.meta.env.SSR to keep secrets/app_id out of client bundle"
    - "Tailwind v4 CSS-first @theme tokens (no tailwind.config.js)"
    - "npm overrides to force a single React copy across a mixed-peer monorepo"

key-files:
  created:
    - "package.json (root workspaces + overrides)"
    - "packages/shared/package.json, packages/shared/src/index.ts"
    - "web/package.json, web/vite.config.ts, web/vitest.config.ts, web/tsconfig*.json"
    - "web/src/styles.css, web/index.html, web/.env.example"
    - "web/src/main.tsx, web/src/App.tsx"
    - "web/src/lib/bandsintown.ts, web/src/data/releases.ts"
    - "web/src/components/{Layout,Header,Footer}.tsx"
    - "web/src/pages/{Home,Discography,Concerts,About,Contact,Stock,NotFound}.tsx"
    - "web/src/test/{setup.ts,build-smoke.test.ts}"
  modified:
    - "package.json (root — workspaces, overrides)"
    - ".gitignore (web/dist, .env)"

key-decisions:
  - "Root overrides pin react/react-dom@19.2.7 to eliminate a react-helmet-async-driven React 18 dual-instance"
  - "@vitejs/plugin-react pinned to 5.1.4 (6.x requires vite@8, breaks vite@7 peer cap)"
  - "vite-react-ssg dirStyle=nested for clean per-route URLs on Vercel"
  - "fetchUpcomingEvents guarded by import.meta.env.SSR so app_id/key never ships to client"
  - "packages/shared kept type-only for Phase 4 (concerts come from Bandsintown, not platform API)"

patterns-established:
  - "SSG build-time loader pattern: routes declare loader: () => ({ events: await fetchUpcomingEvents() })"
  - "Secret/app_id kept out of client bundle via SSR guard + post-build grep assertion"
  - "Single-React-copy enforcement via root npm overrides in a mixed React 18/19 monorepo"

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-04]

# Metrics
duration: 33min
completed: 2026-07-03
---

# Phase 4 Plan 01: Showcase Website Foundation Summary

**npm-workspaces monorepo retrofit + greenfield web/ app (Vite 7 / React 19 / Tailwind v4 / vite-react-ssg) that prerenders all 5 routes plus /stock, with the Bandsintown build-time data contract, Vitest, brand theme, app shell, and stub pages — Bandsintown app_id proven absent from build output.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-03T11:46:19Z
- **Completed:** 2026-07-03T12:19:48Z
- **Tasks:** 4 (Task 2 was a blocking human-verify supply-chain gate)
- **Files modified/created:** 32

## Accomplishments
- Converted the repo root into an npm-workspaces monorepo (web/mobile/api/packages/*) without breaking Expo/Metro — `npm why react-native` reports a single install.
- Created `packages/shared` type-only Concert skeleton for Phase 5 reuse (D-06).
- Scaffolded a buildable `web/` app on the pinned, human-verified toolchain; `vite-react-ssg build` prerenders `/`, `/discography`, `/concerts`, `/about`, `/contact`, `/stock` (nested HTML).
- Locked the `BitEvent` / `fetchUpcomingEvents` build-time contract (SSR-guarded, fail-soft) and the `Release`/`releases[]` config for Wave 1 consumers.
- Established the Tailwind v4 CSS-first theme with UI-SPEC tokens (black bg / #141414 surface / white accent, Bebas Neue + Inter) and the Layout/Header/Footer app shell (3-link nav + 44×44 hamburger, footer About/Contact + social).
- Vitest build-smoke test green; verified no `app_id` string in `web/dist`.

## Task Commits

1. **Task 1: Root npm workspaces + packages/shared skeleton + monorepo regression check** — `dbf83f4` (feat)
2. **Task 2: Verify vite-react-ssg legitimacy (supply-chain gate)** — human-verify checkpoint; approved by user (npmjs.com exists, ~35k weekly downloads, v0.9.0 published, repo present, last commit ~2 months ago). No commit (verification gate).
3. **Task 3: Scaffold web/ tooling + config + Tailwind v4 theme** — `079852c` (chore)
4. **Task 4: App shell, data contracts, stub pages, build-smoke test** — `98ada25` (test / RED) + `dc7a244` (feat / GREEN)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `package.json` (root) — workspaces array, `private:true`, `packageManager`, and `overrides` pinning react/react-dom@19.2.7
- `packages/shared/package.json` + `src/index.ts` — `@bandplatform/shared`, type-only `Concert`
- `web/package.json` — name=web, vite-react-ssg build/dev scripts, pinned deps
- `web/vite.config.ts` — react + tailwindcss plugins, `ssgOptions.dirStyle='nested'`
- `web/vitest.config.ts` — jsdom, globals, setup, react dedupe
- `web/tsconfig.json` / `tsconfig.node.json` / `src/vite-env.d.ts`
- `web/src/styles.css` — Tailwind v4 `@import` + `@theme` UI-SPEC tokens
- `web/index.html` — Vite entry, mount `#root`
- `web/.env.example` — documents non-VITE_ `BANDSINTOWN_APP_ID`
- `web/src/main.tsx` — `ViteReactSSG({ routes })` + @fontsource imports
- `web/src/App.tsx` — RouteRecord tree, build-time event loaders, catch-all
- `web/src/lib/bandsintown.ts` — `BitEvent` contract, `fetchUpcomingEvents` (SSR-guarded, fail-soft), `clean()`
- `web/src/data/releases.ts` — `Release` union + `releases[]` (Crowned)
- `web/src/components/{Layout,Header,Footer}.tsx` — app shell
- `web/src/pages/*.tsx` — 7 stub route pages
- `web/src/test/{setup.ts,build-smoke.test.ts}` — Vitest infra + smoke test
- `web/public/images/HURAKAN_SLAM_ICON_inverted.png` — brand icon
- `.gitignore` — web/dist, dist, .env

## Decisions Made
- **Root `overrides` pin react/react-dom@19.2.7** — the single most consequential decision; it removes the stray React 18 copy dragged in by vite-react-ssg's `react-helmet-async@1.3.0` (peer-capped at React 18) that npm hoisted to the root. Without it, Vitest rendered React-19 elements through react-dom 18, throwing "Objects are not valid as a React child".
- **@vitejs/plugin-react@5.1.4** — latest 6.x requires `vite@^8`, incompatible with the mandated `vite@7` (vite-react-ssg peer cap). 5.1.4 supports vite ^7.
- **dirStyle=nested** — clean `/discography` URLs served from `discography/index.html` on Vercel; also matches the plan's per-route verify paths.
- **SSR-guarded fetch** — wrapping the network body in `if (!import.meta.env.SSR) return []` lets Vite dead-code-eliminate the `app_id` URL string from the client bundle (D-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root React version conflict causing dual-instance test failure**
- **Found during:** Task 4 (build-smoke test GREEN phase)
- **Issue:** `vite-react-ssg` → `react-helmet-async@1.3.0` peer-caps React at 18, so npm installed a react@18.3.1 + react-dom@18.3.1 pair at the monorepo root. `@testing-library/react` (hoisted to root, externalized by Vitest) rendered the app's React-19 elements through react-dom 18 → "Objects are not valid as a React child". Vite alias/dedupe/inline did not redirect RTL's externalized `react-dom` import.
- **Fix:** Added root `overrides: { react: 19.2.7, react-dom: 19.2.7 }` and did a clean reinstall (removed root node_modules + lockfile). Root now has a single React 19.2.7 copy; RTL binds to it.
- **Files modified:** package.json (root)
- **Verification:** `cat node_modules/react-dom/package.json` = 19.2.7; `npm ls react | grep -c react@18` = 0; `npm run test -w web` green; `npm why react-native` = single install (mobile not broken).
- **Committed in:** dc7a244

**2. [Rule 3 - Blocking] @vitejs/plugin-react peer conflict with pinned vite@7**
- **Found during:** Task 3 (dev-dep install)
- **Issue:** `@vitejs/plugin-react@6.0.3` (latest) requires `vite@^8`, conflicting with the mandated `vite@7.3.6` (vite-react-ssg peer cap) → ERESOLVE.
- **Fix:** Pinned `@vitejs/plugin-react@5.1.4` (supports vite ^7).
- **Files modified:** web/package.json
- **Verification:** install exit 0; `npm ls vite -w web` = 7.3.6.
- **Committed in:** 079852c

**3. [Rule 1 - Bug] vite-react-ssg mount id + app_id string in client bundle + flat dir output**
- **Found during:** Task 4 (build)
- **Issue:** (a) index.html used `id="app"` but vite-react-ssg mounts to `#root` → "Could not find a tag with id=root". (b) `app_id` URL string was bundled into client JS because App.tsx imports fetchUpcomingEvents → violated the `grep -r app_id web/dist` empty assertion. (c) Default flat dirStyle emitted `discography.html` not the expected `discography/index.html`.
- **Fix:** (a) index.html mount id `app`→`root`; (b) wrapped the network body in `if (!import.meta.env.SSR) return []` so Vite tree-shakes the app_id string; (c) set `ssgOptions.dirStyle='nested'`.
- **Files modified:** web/index.html, web/src/lib/bandsintown.ts, web/vite.config.ts
- **Verification:** build exit 0, all 6 route `index.html` present, `grep -rl app_id dist` empty.
- **Committed in:** dc7a244

---

**Total deviations:** 3 auto-fixed (3 blocking, 1 of which also covered a correctness/security bug). No architectural changes; no scope creep. All fixes were required to satisfy the plan's own acceptance criteria (single react-native, vite@7 pin, buildable SSG, no app_id leak).

## Issues Encountered
- The dual-React failure resisted the usual Vitest fixes (resolve.dedupe, resolve.alias, server.deps.inline) because `@testing-library/react` is externalized and resolves `react-dom` via Node from the root, bypassing Vite aliases. Root `overrides` + clean reinstall was the deterministic fix. Documented for future web test work.

## User Setup Required

**External service configuration is required before concert data appears (deferred to deploy).** The site builds and deploys fine without it (fail-soft empty state, D-12).
- `BANDSINTOWN_APP_ID` — Bandsintown for Artists → Settings → General → Get API Key. MUST be added as a **non-VITE_** build-time env var (locally as `process.env.BANDSINTOWN_APP_ID`; on Vercel in a later plan). Documented in `web/.env.example`. Artist ID `433176` is hardcoded.

## Next Phase Readiness
- Foundation complete: monorepo, buildable SSG app, test framework, data contracts, theme, app shell, and stub routes are all in place for Wave 1 content plans (04-02 concerts, 04-03 discography, 04-04 about/contact) and 04-05 prerender/deploy.
- Wave 1 owns: real Bandsintown fixture test + live payload verification (04-02), Spotify/YouTube embed components (04-03), real contact addresses (04-04), full prerender-output assertions + Vercel deploy + DNS cutover (04-05).
- No blockers.

## Self-Check: PASSED

All 16 sampled created files verified present on disk; all 4 task commits (dbf83f4, 079852c, 98ada25, dc7a244) verified in git history.

---
*Phase: 04-showcase-website*
*Completed: 2026-07-03*
