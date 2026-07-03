---
phase: 04-showcase-website
plan: 03
subsystem: ui
tags: [react, vite, spotify-embed, youtube-embed, vitest, discography]

# Dependency graph
requires:
  - phase: 04-showcase-website (04-01)
    provides: "Release union type + releases[] config (web/src/data/releases.ts), app shell, Tailwind v4 theme"
provides:
  - "SpotifyEmbed component: iframe by embedType (track/album/playlist) + id, lazy-loaded"
  - "YouTubeEmbed component: youtube-nocookie.com iframe by videoId, lazy-loaded"
  - "ReleaseItem discriminated renderer: exactly one embed per release (D-17), no metadata (D-20)"
  - "Discography route page: maps releases[] into ReleaseItem cards in array order (D-21)"
affects: [04-05-prerender-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union rendering: switch on release.kind to pick exactly one embed component, never both"
    - "Lazy-loaded third-party iframes (loading=lazy) with youtube-nocookie.com for YouTube (no cookies until play)"

key-files:
  created:
    - "web/src/components/SpotifyEmbed.tsx"
    - "web/src/components/SpotifyEmbed.test.tsx"
    - "web/src/components/YouTubeEmbed.tsx"
    - "web/src/components/YouTubeEmbed.test.tsx"
    - "web/src/components/ReleaseItem.tsx"
    - "web/src/components/ReleaseItem.test.tsx"
    - "web/src/pages/Discography.test.tsx"
  modified:
    - "web/src/pages/Discography.tsx"

key-decisions:
  - "SpotifyEmbed height derived from a Record<embedType, height> lookup (152 track / 352 album+playlist) rather than inline conditionals"
  - "YouTubeEmbed adds a Tailwind aspect-video/h-auto/w-full class on top of the fixed width/height attributes, for responsive layout without breaking the iframe's intrinsic size fallback"
  - "Discography.test.tsx mocks '../data/releases' with vi.mock to assert array-order mapping independent of the real seeded config"

patterns-established:
  - "Never-both invariant test pattern: assert iframe count === 1 and the absent embed type's origin string is not present in src, per release kind"

requirements-completed: [WEB-02]

# Metrics
duration: 2min
completed: 2026-07-03
---

# Phase 4 Plan 03: Discography Streaming Embeds Summary

**Discography page rendering the hand-authored releases[] config as one lazy-loaded Spotify or YouTube (nocookie) iframe per entry, in array order, with the never-both invariant enforced and unit-tested.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-03T14:44:02+02:00 (first commit)
- **Completed:** 2026-07-03T14:45:50+02:00 (last commit)
- **Tasks:** 2
- **Files modified/created:** 8

## Accomplishments
- Built `SpotifyEmbed` porting the exact production `<iframe>` attribute set from `website/crowned/index.html` (lazy-loaded, correct `allow` list, height by embed type).
- Built `YouTubeEmbed` on the `youtube-nocookie.com` domain (Pitfall 6), lazy-loaded, with `allowFullScreen`.
- Built `ReleaseItem`, a discriminated-union renderer proven by test to emit exactly one embed per release and never both (D-17), with zero metadata rendered (D-20).
- Wired `Discography.tsx` to map `releases[]` in array order into `ReleaseItem` cards (D-21), replacing the Wave 0 text-only stub.
- Full web test suite (9 files / 34 tests) green; production build (`vite-react-ssg build`) still prerenders `/discography` successfully.

## Task Commits

Each task was committed atomically via TDD RED/GREEN pairs:

1. **Task 1: SpotifyEmbed + YouTubeEmbed embed components**
   - `30787d4` (test — RED): failing tests for both embed components
   - `62961fe` (feat — GREEN): implemented both components, tests pass
2. **Task 2: ReleaseItem discriminated renderer + Discography route page**
   - `1d75eeb` (test — RED): failing tests for ReleaseItem and Discography
   - `574bca0` (feat — GREEN): implemented ReleaseItem, rewired Discography page

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `web/src/components/SpotifyEmbed.tsx` — iframe by `embedType`/`id`, height 152 (track) or 352 (album/playlist), `loading="lazy"`
- `web/src/components/SpotifyEmbed.test.tsx` — src/height/lazy/title assertions for all three embed types
- `web/src/components/YouTubeEmbed.tsx` — iframe on `www.youtube-nocookie.com`, `loading="lazy"`, `allowFullScreen`
- `web/src/components/YouTubeEmbed.test.tsx` — nocookie-domain and lazy-loading assertions, plus a negative assertion against the plain `youtube.com/embed` domain
- `web/src/components/ReleaseItem.tsx` — switches on `release.kind`, renders exactly one embed, no metadata
- `web/src/components/ReleaseItem.test.tsx` — never-both invariant tests for both kinds + no-metadata assertion
- `web/src/pages/Discography.tsx` — maps `releases` into `ReleaseItem` cards in array order (replaces Wave 0 text stub)
- `web/src/pages/Discography.test.tsx` — mocks `releases[]` with a mixed-kind fixture, asserts order-preserving embed count and no metadata text

## Decisions Made
- Height lookup table (`Record<SpotifyEmbedType, number>`) chosen over inline ternaries for the three Spotify embed heights — easier to extend if Spotify adds another embed type.
- `Discography.test.tsx` uses `vi.mock('../data/releases', ...)` so the order/count assertions are independent of the real seeded config (currently a single Crowned track) and will keep passing as the real config grows.
- Kept the Secondary-surface card wrapper (`#141414` + hairline border) on `ReleaseItem` per UI-SPEC, with no internal padding-driven metadata slot (nothing to leave empty since D-20 forbids metadata entirely).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the specified TDD RED → GREEN flow with no blocking issues, no missing critical functionality, and no architectural changes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required (Spotify/YouTube embeds require no API keys; ids are developer-authored constants in `releases.ts`, consistent with the threat model's `accept` disposition on iframe src construction).

## Next Phase Readiness
- WEB-02 fully satisfied: `/discography` renders every `releases[]` entry as a lazy-loaded, correctly-sourced Spotify or YouTube embed, in authored order, with zero metadata and the never-both invariant enforced and tested.
- `web/src/data/releases.ts` remains the single point of content curation — adding a release later is a one-line array addition, no component changes needed.
- No blockers for 04-04 (about/contact) or 04-05 (prerender/deploy verification, which should assert `/discography` prerenders with the seeded Crowned track embed present in the static HTML).

## Self-Check: PASSED

All 8 created/modified files verified present on disk; both task commit pairs (30787d4/62961fe, 1d75eeb/574bca0) verified in git history; full web test suite (34 tests) green; production build still prerenders `/discography`.

---
*Phase: 04-showcase-website*
*Completed: 2026-07-03*
