---
phase: 05-online-shop-core
plan: 05
subsystem: ui
tags: [zustand, persist, react, cart-state, hydration]

# Dependency graph
requires:
  - phase: 05-online-shop-core (05-01)
    provides: Product/Variant shared types, products.ts fetch client (fetchProducts/fetchProduct/pingHealth)
  - phase: 05-online-shop-core (05-02)
    provides: zustand dependency installed and verified in web/package.json
provides:
  - "web/src/lib/cartStore.ts — zustand cart store (useCartStore) with persist + skipHydration, merge/cap addLine, setQuantity/removeLine/clearCart"
  - "web/src/components/Layout.tsx — one-time rehydrate + D-10 keep-alive ping wired into the app-wide mount point"
affects: [05-06, 05-07, 05-08, checkout, cart-page, product-detail, header-badge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "zustand persist + skipHydration + manual rehydrate() in a mount-only useEffect — first global client state in this codebase, sourced from zustand's own SSR/SSG-hydration-safety API"
    - "Merge-by-composite-key (productId+variantSku) + Math.min cap on quantity mutations"

key-files:
  created:
    - web/src/lib/cartStore.ts
    - web/src/lib/cartStore.test.ts
  modified:
    - web/src/components/Layout.tsx

key-decisions:
  - "addLine returns a new array via .map() (not direct mutation of the found line) to keep the reducer pure and Zustand-subscription-safe"
  - "Layout.tsx is the single rehydrate + pingHealth call site — the one component guaranteed to mount on every route"

patterns-established:
  - "Pattern 4 (zustand persist + skipHydration): cartStore.ts is the canonical example; any future global client store in this codebase should follow the same shape (skipHydration: true, hasHydrated flag, rehydrate from a root-level mount effect)"

requirements-completed: [SHOP-02]

# Metrics
duration: 4min
completed: 2026-07-05
---

# Phase 5 Plan 5: Cart Store Summary

**Zustand cart store with persist + skipHydration, merge-and-cap add-to-cart logic (D-13), and a single rehydrate + Render keep-alive ping wired into Layout.tsx**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-05T22:26:00+02:00
- **Completed:** 2026-07-05T22:30:14+02:00
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- First global client state in the codebase: `useCartStore` (zustand) with `persist` targeting `localStorage` under key `hurakan-cart`, `skipHydration: true` so the store never reads `localStorage` during import/module-init (D-11/D-12).
- `addLine` merges a line by `productId+variantSku` and caps the resulting quantity at `stockCap` via `Math.min` (D-13); a genuinely new variant is appended as-is.
- `setQuantity`, `removeLine`, `clearCart` helpers cover the remaining cart-page mutations (D-14 groundwork — the flag/no-silent-adjust logic itself lives in a later plan's `Cart.tsx`).
- `Layout.tsx` (mounted on every route) now rehydrates the cart once on mount (`useCartStore.persist.rehydrate()` → `setHasHydrated(true)`) and fires the D-10 fire-and-forget `pingHealth()` keep-alive ping, warming the Render free-tier instance the moment any visitor lands on any page.

## Task Commits

Each task was committed atomically:

1. **Task 1: cartStore with persist + skipHydration + merge/cap logic** - `0fa3845` (feat)
2. **Task 2: Rehydrate the cart + warm the API once on mount in Layout.tsx** - `ddd5cdc` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `web/src/lib/cartStore.ts` - zustand cart store: CartLine/CartState types, persist+skipHydration config (D-11/D-12), addLine/setQuantity/removeLine/clearCart
- `web/src/lib/cartStore.test.ts` - 8 tests covering hydration-guard, new-line append, merge+cap (3+5 cap 4 → 4), distinct-variant lines, setQuantity, removeLine, clearCart
- `web/src/components/Layout.tsx` - added mount-only `useEffect` calling `useCartStore.persist.rehydrate()`, `setHasHydrated(true)`, `pingHealth()`; Header/Outlet/Footer shell unchanged

## Decisions Made
- `addLine`'s merge branch rebuilds the `lines` array with `.map()` instead of mutating the found element in place (the RESEARCH.md/PATTERNS.md pattern snippet mutated `existing.quantity` directly before spreading) — kept the reducer fully immutable to avoid any risk of stale-reference bugs under React/Zustand's shallow-equality subscription model. Behavior is identical; only the implementation style differs from the plan's illustrative snippet.
- No other deviations — plan's interface contract (CartLine shape, useCartStore state shape, persist config name/storage/skipHydration, Layout rehydrate site) matched exactly.

## Deviations from Plan

None - plan executed exactly as written (the addLine immutability tweak above is a style choice within the plan's own behavior spec, not a deviation from any `<behavior>` or `<action>` requirement).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useCartStore` is ready for consumption by product-detail (add-to-cart), cart page, checkout, and the Header cart badge (`lines`, derived `itemCount`/`subtotal` selectors can be computed by consumers directly from `lines`).
- `hasHydrated` is available for any consumer that needs to gate localStorage-derived rendering until after the Layout mount effect has run.
- No blockers for downstream plans in this wave.

---
*Phase: 05-online-shop-core*
*Completed: 2026-07-05*
