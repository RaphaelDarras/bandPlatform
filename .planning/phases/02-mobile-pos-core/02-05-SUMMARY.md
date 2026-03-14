---
phase: 02-mobile-pos-core
plan: 05
subsystem: mobile
tags: [react-native, expo-router, sqlite, zustand, bottom-sheet, tdd, offline-first, pos, selling-flow]

# Dependency graph
requires: [02-03]
provides:
  - Product grid with FlatList of 2-column tiles and per-variant stock counts
  - ProductTile with single-variant direct-add and multi-variant VariantPicker
  - VariantPicker inline picker with stock counts, zero-stock variants tappable
  - CartBar sticky bottom bar with item count and total
  - CartSheet expandable sheet with quantity controls and Review Sale button
  - useSaleRecording hook for atomic offline sale write (sale + outbox)
  - Review screen with payment method, currency, discount, grand total
  - Selling stack layout (header + CartBar)
affects: [02-06, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ProductTile: single-variant direct-add, multi-variant shows inline VariantPicker"
    - "useSaleRecording: UUID generation + recordSaleLocally + updateLocalStock + clearCart + pendingCount increment"
    - "Review screen: local state for paymentMethod, cartStore for currency/discount, useSaleRecording for confirm"
    - "Zero-stock variants remain tappable — concert sales never rejected (per user decision)"

key-files:
  created:
    - mobile/src/db/products.ts
    - mobile/src/features/catalog/ProductGrid.tsx
    - mobile/src/features/catalog/ProductTile.tsx
    - mobile/src/features/catalog/VariantPicker.tsx
    - mobile/src/features/cart/CartBar.tsx
    - mobile/src/features/cart/CartSheet.tsx
    - mobile/src/features/cart/useSaleRecording.ts
    - mobile/src/app/selling/_layout.tsx
    - mobile/src/app/selling/index.tsx
    - mobile/src/app/selling/review.tsx
    - mobile/src/__tests__/features/catalog/productGrid.test.tsx
    - mobile/src/__tests__/features/cart/saleRecording.test.ts
  modified: []

key-decisions:
  - "VariantPicker rendered as inline sibling of ProductTile (not a BottomSheet) — simpler to test and avoids nested sheet issues"
  - "getByLabelText used in RTL tests for variant rows (not getByA11yLabel — that API does not exist in @testing-library/react-native v13)"
  - "useSaleRecording reads pendingCount at call time via Zustand getState pattern — avoids stale closure issue"

requirements-completed: [POS-02, POS-09, POS-10, POS-01]

# Metrics
duration: 14min
completed: 2026-03-14
---

# Phase 2 Plan 5: Selling Flow — Product Grid, Cart, and Atomic Sale Recording Summary

**Complete POS selling flow: touch-friendly product grid with per-variant stock, inline variant picker, CartBar/CartSheet with quantity controls, sale review screen with payment/currency/discount, and atomic offline sale recording via SQLite + outbox**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-14T14:51:33Z
- **Completed:** 2026-03-14T15:05:13Z
- **Tasks:** 2/2
- **Files modified:** 12 (all created)

## Accomplishments

- Built complete POS selling flow from product selection through sale confirmation
- Product grid with 2-column FlatList, ProductTile showing name, price, and stock summary (e.g., "S:3 M:12 XL:0")
- Single-variant products add directly to cart on tap; multi-variant products show inline VariantPicker
- VariantPicker shows each variant with stock count; zero-stock variants remain tappable (concert sales never rejected)
- CartBar sticky bottom bar with item count badge, formatted total, visible only when cart has items
- CartSheet bottom sheet with per-item quantity controls (+/-), line totals, Remove buttons, and Review Sale button
- useSaleRecording hook: generates UUIDs, builds LocalSale + OutboxEntry, writes atomically via recordSaleLocally, decrements local stock, clears cart, increments sync pendingCount
- Review screen: payment method selector (Cash/Card/E-transfer/PayPal), currency selector (EUR/GBP/USD/CAD), discount amount + flat/percent toggle, grand total, Confirm Sale button
- 14 unit tests passing across catalog and cart test suites (9 + 5)

## Task Commits

1. **Task 1: Product grid, tiles, variant picker, and cart components** - `31555df`
2. **Task 2: Sale review screen and atomic offline sale recording** - `e78f92c`

## Files Created

- `mobile/src/db/products.ts` — getCachedProducts, upsertProducts, getProductById, updateLocalStock
- `mobile/src/features/catalog/ProductGrid.tsx` — FlatList 2-column with pull-to-refresh
- `mobile/src/features/catalog/ProductTile.tsx` — Pressable card, single/multi-variant logic
- `mobile/src/features/catalog/VariantPicker.tsx` — Inline variant list with stock counts
- `mobile/src/features/cart/CartBar.tsx` — Sticky bar, visible when items > 0, opens CartSheet
- `mobile/src/features/cart/CartSheet.tsx` — BottomSheet with quantity controls and Review Sale
- `mobile/src/features/cart/useSaleRecording.ts` — Atomic sale recording hook
- `mobile/src/app/selling/_layout.tsx` — Stack layout with CartBar and back button
- `mobile/src/app/selling/index.tsx` — Product grid screen with offline fallback
- `mobile/src/app/selling/review.tsx` — Review screen with all sale controls
- `mobile/src/__tests__/features/catalog/productGrid.test.tsx` — 9 tests
- `mobile/src/__tests__/features/cart/saleRecording.test.ts` — 5 tests

## Decisions Made

- **VariantPicker rendered inline:** Used a simple `useState` toggle in ProductTile to show VariantPicker as a sibling view rather than a `@gorhom/bottom-sheet`. This is easier to test with RTL and avoids issues with mocking BottomSheet's imperative API in tests.
- **RTL query API:** Used `getByLabelText` (not `getByA11yLabel`) — the latter does not exist in `@testing-library/react-native` v13. Accessibility labels on Pressable rows provide the correct query target.
- **useSaleRecording pendingCount:** Reads current pendingCount from Zustand at call time and sets `pendingCount + 1` — avoids stale closure. The `setPendingCount` action is used directly (not `incrementPendingCount`) since syncStore uses `setPendingCount` only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getByA11yLabel is not a function in @testing-library/react-native v13**
- **Found during:** Task 1 (first test run)
- **Issue:** Tests used `getByA11yLabel` (React Testing Library Web API) which does not exist in the React Native version. Tests failed with `TypeError: getByA11yLabel is not a function`.
- **Fix:** Updated test queries to use `getByLabelText` which maps to `accessibilityLabel` in RTNL v13.
- **Files modified:** `mobile/src/__tests__/features/catalog/productGrid.test.tsx`
- **Committed in:** 31555df

**2. [Rule 1 - Bug] CartBar CartSheetHandle ref type mismatch**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `useRef<{ open: () => void }>(null)` is not assignable to `Ref<CartSheetHandle>` because `CartSheetHandle` also requires `close()`.
- **Fix:** Updated CartBar ref type to `useRef<CartSheetHandle>(null)` and imported `CartSheetHandle`.
- **Files modified:** `mobile/src/features/cart/CartBar.tsx`
- **Committed in:** 31555df

---

**Total deviations:** 2 auto-fixed (both bugs during TDD RED→GREEN transition)
**Impact on plan:** Minor — test query API difference, TypeScript type precision. No architectural changes.

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm test` — 55 tests pass (14 new + 41 from previous plans)
- Product grid shows tiles with per-variant stock counts
- Single-variant adds directly, multi-variant opens inline VariantPicker
- Cart bar visible only when items > 0, shows count + total
- Review screen has all controls: payment method, currency, discount, grand total
- Sale recording works offline (no API calls), writes atomically to SQLite + outbox
- Cart clears after confirmation

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
