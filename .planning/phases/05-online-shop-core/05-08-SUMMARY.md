---
phase: 05-online-shop-core
plan: 08
subsystem: ui
tags: [react, zustand, cart, revalidation, vitest]

# Dependency graph
requires:
  - phase: 05-online-shop-core plan 01
    provides: fetchProducts client + Product/Variant shared types
  - phase: 05-online-shop-core plan 04
    provides: QuantityStepper leaf component
  - phase: 05-online-shop-core plan 05
    provides: useCartStore (lines/hasHydrated/setQuantity/removeLine)
provides:
  - Cart.tsx (/cart page) rendering cart lines, revalidating against live
    stock on load, flagging stale/over-stock lines, gating checkout
affects: [05-online-shop-core plan 09+ (App.tsx routing, Checkout.tsx)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cart revalidation: hasHydrated-gated useEffect calling fetchProducts(),
       writing only to local component state (never store.setQuantity) so
       flagged lines are never silently auto-adjusted (D-14)"
    - "Missing product/variant in the revalidation response treated as
       currentStock 0 for flagging purposes (Open Q3)"

key-files:
  created:
    - web/src/pages/Cart.tsx
    - web/src/pages/Cart.test.tsx
  modified: []

key-decisions:
  - "Subtotal computed inline in Cart.tsx via lines.reduce (no subtotal
     selector added to cartStore.ts — out of this plan's files_modified scope)"
  - "Flagged lines render Update/Remove actions in place of the normal
     stepper+line-total block; the outer remove icon-button is only shown
     for non-flagged lines to avoid duplicate 'Remove {name} from cart'
     aria-labels in the same row"
  - "Update action (flagged, stock>0) explicitly sets quantity to
     currentStock on user click — an explicit user action, not the
     forbidden silent auto-adjust (D-14 targets automatic mutation, not
     user-triggered fixes)"
  - "Page always renders <h1>Cart</h1>; empty-cart heading is a separate
     <h2>Your cart is empty</h2> below it, mirroring Concerts.tsx (h1) +
     ConcertList.tsx's empty-state h2 delegation pattern"

requirements-completed: [SHOP-02, SHOP-13]

duration: 6min
completed: 2026-07-05
---

# Phase 5 Plan 08: Cart Page Summary

**Cart page with live-stock revalidation on load, flagged-line checkout gate (no silent auto-adjust), and D-26 empty state**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-05T23:05:39+02:00 (previous plan's completion baseline)
- **Completed:** 2026-07-05T23:11:17+02:00
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `/cart` page renders bordered line cards (64x64 thumbnail, name, variant label, unit price, QuantityStepper, line total, 44x44 remove button) delegating to `QuantityStepper` and reading/writing `useCartStore`
- Revalidation: a `hasHydrated`-gated `useEffect` calls `fetchProducts()` and flags any line where `quantity > currentStock` or `currentStock === 0` (including products missing from the live catalog) — flagging never mutates the store, only local component state
- Flagged lines swap their stepper/total for a `border-[#ef4444]` warning + explicit Update ("set to available stock")/Remove actions; Checkout stays disabled with "Resolve the flagged items above to continue." while any line is flagged, and becomes a `Link` to `/checkout` once clean
- Empty cart (hydrated, zero lines) shows "Your cart is empty" / "Looks like you haven't added anything yet." / "Browse Shop" CTA to `/shop`, matching `ConcertList.tsx`'s empty-state shape
- Subtotal computed as `Σ unitPrice * quantity`, formatted `$X CAD`

## Task Commits

TDD task, executed as a full RED → GREEN cycle:

1. **Task 1 (RED): failing test for cart page** - `1ddb842` (test)
2. **Task 1 (GREEN): implement cart page** - `a16246a` (feat)

**Plan metadata:** (this commit, docs — see final commit below)

## Files Created/Modified
- `web/src/pages/Cart.tsx` - Cart page: line list, revalidation effect, flagging, order summary, checkout gate, empty state
- `web/src/pages/Cart.test.tsx` - 6 tests: empty state, populated list, over-quantity flag, zero-stock flag, checkout-link-enabled, subtotal sum

## Decisions Made
- Subtotal logic lives in `Cart.tsx` (plain `.reduce()`), not a new `cartStore.ts` selector — `cartStore.ts` was outside this plan's `files_modified` scope and the plan's own interface contract only names `lines/setQuantity/removeLine` as consumed exports.
- Deduplicated the "Remove {name} from cart" aria-label per row: normal lines get the icon-button remove; flagged lines get a text "Remove" action instead of both, avoiding two elements sharing the same accessible name in a single `<li>`.
- "Update" (flagged, stock > 0) is a discrete, user-triggered click that sets quantity to the live stock cap — distinguished from the forbidden *automatic* adjustment D-14 prohibits (which is what the revalidation `useEffect` itself must never do).

## Deviations from Plan

None — plan executed exactly as written. The revalidation, flagging, gating, and empty-state behavior all match the plan's `<behavior>`/`<action>` spec and UI-SPEC §3 verbatim; no bugs, missing functionality, or architectural changes were needed.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `Cart.tsx` exists and is fully tested, but `/cart` is not yet wired into `web/src/App.tsx`'s route table (that file is out of this plan's scope) — a later Phase 5 plan (routing/Checkout.tsx) must add the `{ path: 'cart', lazy: () => import('./pages/Cart') }` route entry alongside `/checkout`.
- Cart page assumes `Checkout.tsx` exists at `/checkout` for the enabled-Checkout `Link` target; not yet built (future plan).
- No blockers.

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*
