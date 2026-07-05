---
phase: 05-online-shop-core
plan: 10
subsystem: ui
tags: [react, react-router, zustand, tailwind]

# Dependency graph
requires:
  - phase: 05-online-shop-core (Plan 05)
    provides: useCartStore with lines[] and quantity-based line items
provides:
  - Shop nav link in Header (desktop + mobile) linking to /shop
  - Persistent cart icon + item-count badge in Header linking to /cart
  - Shop Merch teaser section on Home with a Shop Now CTA to /shop
affects: [05-online-shop-core remaining plans (Checkout/Order flow), any future phase touching Header.tsx or Home.tsx]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header cart icon reads itemCount via a useCartStore selector (sum of line quantities), mirrors NAV_LINKS single-array-feeds-both-desktop-and-mobile pattern"

key-files:
  created:
    - web/src/components/Header.test.tsx
  modified:
    - web/src/components/Header.tsx
    - web/src/pages/Home.tsx
    - web/src/pages/Home.test.tsx

key-decisions:
  - "Cart icon wrapped with the hamburger button in a shared flex container (not just a sibling in the nav row) so both controls align cleanly at the far right of the nav on both desktop and mobile"
  - "Shop Merch teaser inserted immediately after 'Next Show' (before 'Latest Release'), matching UI-SPEC's 'either order acceptable' guidance while keeping the wrapping gap-12 rhythm"
  - "Home.test.tsx's pre-existing 'renders no merch/shop teaser' assertion was replaced (not kept alongside) with a positive assertion for the new section — that old assertion encoded Phase 4's D-25 scope boundary which Phase 5 intentionally supersedes"

patterns-established: []

requirements-completed: [SHOP-01, SHOP-02]

# Metrics
duration: 5min
completed: 2026-07-05
---

# Phase 5 Plan 10: Shop Entry Points Summary

**Shop nav link + live cart badge wired into Header.tsx (visible on every page via Layout), plus a Shop Merch teaser with a Shop Now CTA added to Home.tsx.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-05T21:28:57Z
- **Completed:** 2026-07-05T21:34:09Z
- **Tasks:** 2
- **Files modified:** 4 (2 created/modified pairs)

## Accomplishments
- Header nav now includes "Shop" (desktop nav + mobile hamburger menu), added via a single `NAV_LINKS` entry that feeds both render paths
- A persistent cart icon (inline SVG, 44x44 tap target) links to `/cart` on every page, outside the `md:hidden` hamburger gate — visible on desktop and mobile alike
- Cart icon shows a live item-count badge (sum of line quantities via a `useCartStore` selector), hidden entirely at 0 items; `aria-label` is `"Cart"` when empty and `"Cart, {n} items"` otherwise
- Home page gained a "Shop Merch" section (after "Next Show") with a "Shop Now" accent-CTA link to `/shop`, matching the existing hero button styling

## Task Commits

1. **Task 1: Header — Shop nav link + persistent cart icon/badge** - `20271f0` (feat)
2. **Task 2: Home page merch teaser section** - `d5d61ee` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `web/src/components/Header.tsx` - Added `{ to: '/shop', label: 'Shop' }` to `NAV_LINKS`; added persistent cart `<Link to="/cart">` with inline-SVG bag icon, item-count badge, and dynamic `aria-label`
- `web/src/components/Header.test.tsx` - New: Shop link present, cart link present, badge shows count when >0, no badge + plain "Cart" label when 0
- `web/src/pages/Home.tsx` - New "Shop Merch" `<section>` after "Next Show" with heading, body copy, and "Shop Now" accent CTA to `/shop`
- `web/src/pages/Home.test.tsx` - Replaced the obsolete "renders no merch/shop teaser" test with a positive assertion for the new section + link

## Decisions Made
- Cart icon and hamburger button share a `flex items-center` wrapper div (new markup, not just adjacent siblings) so alignment stays clean now that there are two right-aligned controls instead of one
- Badge count text uses `min-w-[18px]` + `px-1` rather than a fixed circle, so double-digit counts don't get clipped while still looking circular for single digits
- Existing Home test asserting the ABSENCE of a merch teaser was intentionally replaced, not preserved as a skipped/updated negative case — Phase 5's whole purpose is to add what Phase 4's D-25 explicitly deferred

## Deviations from Plan

None - plan executed exactly as written. The one test-file change beyond what Task 2's action described verbatim (replacing rather than purely "extending" `Home.test.tsx`) was already anticipated by the plan's own read_first/action instructions ("extend Home.test.tsx — keep green") and required removing a test whose assertion had become the opposite of the new intended behavior; this is a direct, in-scope consequence of the task, not an unplanned deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shop is now discoverable from every page (nav + Home CTA) and the cart is reachable everywhere with a live badge — SHOP-01/SHOP-02 satisfied
- This was Plan 10 of 11 in Phase 05-online-shop-core; one plan remains in this phase
- Full `web` test suite (109 tests across 22 files) passes after these changes

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`20271f0`, `d5d61ee`) verified present in git history.
