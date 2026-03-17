---
phase: 02-mobile-pos-core
verified: 2026-03-14T16:30:00Z
status: passed
score: 24/24 must-haves verified
gaps: []
human_verification:
  - test: "PIN entry flow on device — tap digits, login, tab navigation"
    expected: "4-6 digit keypad accepts input, authenticates online with API, offline with cached hash, redirects to tabs"
    why_human: "UI interaction, React Native rendering, and network transitions cannot be verified programmatically"
  - test: "Session expiry alert appears 30 minutes before JWT expires"
    expected: "Alert.alert fires with 'Session Expiring' message exactly 30 minutes before exp claim"
    why_human: "Timer behavior and Alert.alert rendering require a running app on a device/simulator"
  - test: "Selling flow end-to-end: product grid -> variant picker -> cart -> review -> confirm"
    expected: "Products display with stock counts, variant picker opens on multi-variant tap, cart bar shows total, confirm writes to SQLite and resets cart"
    why_human: "Full UI flow including BottomSheet rendering and SQLite write confirmation requires device/simulator"
  - test: "Sync indicator on Dashboard changes color correctly"
    expected: "Green dot when online and synced, yellow when pendingCount > 0, red when offline"
    why_human: "Requires toggling device connectivity to observe live state changes"
  - test: "Outbox sync fires on connectivity restore"
    expected: "Queued offline sales submit to POST /api/sales/batch when wifi reconnects, pendingCount drops to 0"
    why_human: "Requires toggling device connectivity during active app session"
---

# Phase 02: Mobile POS Core Verification Report

**Phase Goal:** Band members can track concert sales and manage inventory offline with automatic sync when connectivity returns
**Verified:** 2026-03-14T16:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can set a PIN via POST /api/auth/pin-setup | VERIFIED | `api/routes/auth.js` lines 138-163: authenticated route, bcrypt.hash(pin, salt), stored on admin.pinHash |
| 2 | Admin can login with PIN via POST /api/auth/pin-login and receive JWT | VERIFIED | `api/routes/auth.js` lines 170-219: bcrypt.compare, 24h JWT signed and returned |
| 3 | Sale model accepts etransfer, paypal payment methods and currency, discount, discountType, voidedAt, idempotencyKey fields | VERIFIED | `api/models/Sale.js`: enum includes etransfer/paypal, all 7 fields present, sparse unique index on idempotencyKey line 90 |
| 4 | Concert CRUD endpoints work (GET list, POST create, GET detail, PATCH close/reopen) | VERIFIED | `api/routes/concerts.js` lines 10-93: all 4 operations implemented, registered in api/index.js line 25 |
| 5 | Mobile app can submit a batch of offline sales with idempotency keys and duplicates are silently skipped | VERIFIED | `api/routes/sales.js` lines 16-98: findOne idempotencyKey check, skip on match, returns {created, skipped, sales} |
| 6 | Sales can be voided and unvoided with stock adjustments | VERIFIED | `api/routes/sales.js` lines 124-186: void sets voidedAt/voidedBy + $inc stock reversal; unvoid clears + re-deducts |
| 7 | Sales can be listed filtered by concertId | VERIFIED | `api/routes/sales.js` lines 105-118: filter.concertId applied when query param present |
| 8 | Expo project initializes and TypeScript compiles without errors | VERIFIED | `mobile/` directory exists, `npx tsc --noEmit` passes (confirmed via Plan 03 summary, 0 errors through Plan 07) |
| 9 | SQLite database opens in WAL mode and creates all required tables | VERIFIED | `mobile/src/db/index.ts`: getDb() singleton, `PRAGMA journal_mode = WAL`; `mobile/src/db/migrations.ts`: 5 tables created |
| 10 | Outbox table supports atomic sale + outbox write in single transaction | VERIFIED | `mobile/src/db/outbox.ts` lines 38-73: `db.withTransactionAsync` writes both sales and outbox rows atomically |
| 11 | Cart store persists items across app backgrounding via MMKV | VERIFIED | `mobile/src/stores/cartStore.ts`: MMKV v4 createMMKV({id:'cart-store'}), Zustand persist middleware wired |
| 12 | Cart total calculates correctly with flat and percent discounts | VERIFIED | `mobile/src/stores/cartStore.ts` lines 67-75: flat uses `Math.max(0, subtotal - discount)`, percent uses `subtotal * (1 - discount/100)`; 13 passing cartStore tests |
| 13 | User can enter 4-6 digit PIN and authenticate into the app | VERIFIED | `mobile/src/app/(auth)/pin.tsx`: full numeric keypad, 4-6 digit constraint, calls useAuth().login, routes to /(tabs) on success |
| 14 | PIN hash stored in expo-secure-store after first online login | VERIFIED | `mobile/src/features/auth/pinAuth.ts`: setupPinLocally stores SHA-256 hash and JWT in SecureStore |
| 15 | Offline login works by comparing input PIN hash against stored hash | VERIFIED | `mobile/src/features/auth/useAuth.ts` lines 55-73: verifyPinOffline + getCachedToken offline path |
| 16 | Authenticated user sees 4-tab navigation: Dashboard, History, Stock, Settings | VERIFIED | `mobile/src/app/(tabs)/_layout.tsx`: JS Tabs with 4 screens (index, history, stock, settings), tab bar hides in selling mode |
| 17 | User receives in-app alert 30 minutes before JWT session expires | VERIFIED | `mobile/src/features/auth/sessionExpiry.ts`: scheduleExpiryWarning calculates (exp*1000 - 30min) delay; wired in useAuth.ts on login/logout; 12 unit tests with fake timers |
| 18 | User can see product grid with tiles showing per-variant stock counts | VERIFIED | `mobile/src/features/catalog/ProductTile.tsx` + `ProductGrid.tsx`: FlatList 2-column, stock summary "S:3 M:12 XL:0" pattern, 9 tests |
| 19 | Confirming sale writes atomically to SQLite (sale + outbox) and resets cart | VERIFIED | `mobile/src/features/cart/useSaleRecording.ts`: recordSaleLocally (atomic), clearCart(), setPendingCount+1; 5 tests |
| 20 | User can view concert list, create concerts, and close with totals | VERIFIED | `mobile/src/app/concerts/index.tsx`, `new.tsx`, `[id].tsx`: full CRUD screens; useConcerts.ts handles online/offline |
| 21 | User can view transaction history grouped by concert with void/unvoid | VERIFIED | `mobile/src/features/history/useHistory.ts`: grouping + sort + voidSale/unvoidSale; history tab SectionList; sale detail; 8 tests |
| 22 | App syncs queued offline sales automatically when connectivity returns | VERIFIED | `mobile/src/features/sync/SyncManager.ts`: requestSync with batching + backoff; `useConnectivity.ts`: NetInfo offline→online triggers requestSync; 13 sync tests |
| 23 | User can see real-time inventory levels and restock products | VERIFIED | `mobile/src/app/(tabs)/stock.tsx` (rewritten, expandable rows), `mobile/src/app/restock.tsx` (4-step wizard); useStock.ts; 8 tests |
| 24 | Dashboard sync indicator reflects actual connectivity and pending count | VERIFIED | `mobile/src/app/(tabs)/index.tsx`: SyncIndicator reads useSyncStore.isOnline + pendingCount, shows green/yellow/red dot |

**Score:** 24/24 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `api/routes/auth.js` | VERIFIED | PIN setup (lines 138-163) and PIN login (lines 170-219) wired, bcrypt hashing, 24h JWT |
| `api/routes/concerts.js` | VERIFIED | All 4 endpoints, Concert.find/create/findById/findByIdAndUpdate, registered in index.js |
| `api/models/Sale.js` | VERIFIED | All 7 new fields present; sparse unique index on idempotencyKey |
| `api/models/Admin.js` | VERIFIED | pinHash: String field present (line 36) |
| `api/tests/pin-auth.test.js` | VERIFIED | Exists and passing |
| `api/tests/concerts.test.js` | VERIFIED | Exists and passing |

### Plan 02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `api/routes/sales.js` | VERIFIED | POST /batch, GET /, POST /:id/void, POST /:id/unvoid — all substantive |
| `api/tests/sales-batch.test.js` | VERIFIED | Exists and passing (19 tests) |

### Plan 03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `mobile/package.json` | VERIFIED | expo@55.0.6 and all dependencies installed |
| `mobile/src/db/index.ts` | VERIFIED | getDb() singleton with WAL mode |
| `mobile/src/db/migrations.ts` | VERIFIED | 5 table schemas |
| `mobile/src/db/outbox.ts` | VERIFIED | recordSaleLocally, getPendingOutboxRows, markOutboxDone, incrementAttempt — all substantive |
| `mobile/src/stores/cartStore.ts` | VERIFIED | MMKV v4 (createMMKV), Zustand persist, flat/percent discount math |
| `mobile/src/stores/authStore.ts` | VERIFIED | Exists with setToken/clearAuth |
| `mobile/src/stores/syncStore.ts` | VERIFIED | Exists with isOnline/pendingCount/consecutiveFailures |
| `mobile/src/i18n/index.ts` | VERIFIED | i18next with EN/FR |

### Plan 04 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `mobile/src/features/auth/pinAuth.ts` | VERIFIED | hashPin, setupPinLocally, verifyPinOffline, getCachedToken — all substantive, SecureStore wired |
| `mobile/src/features/auth/useAuth.ts` | VERIFIED | login (online+offline), logout, scheduleExpiryWarning wired |
| `mobile/src/features/auth/sessionExpiry.ts` | VERIFIED | parseJwtExp, scheduleExpiryWarning, clearExpiryWarning |
| `mobile/src/api/client.ts` | VERIFIED | Axios instance, Bearer interceptor reading authStore.getState().token, 401 clearAuth |
| `mobile/src/api/auth.ts` | VERIFIED | apiPinLogin, apiPinSetup, apiVerifyToken |
| `mobile/src/app/(auth)/pin.tsx` | VERIFIED | Full numeric keypad, offline cold-start message, 4-6 digit constraint |
| `mobile/src/app/(tabs)/_layout.tsx` | VERIFIED | JS Tabs, 4 tabs, selling mode tab hiding via cartStore.concertId |
| `mobile/src/app/(tabs)/index.tsx` | VERIFIED | 7 action cards, SyncIndicator wired to syncStore |
| `mobile/src/__tests__/features/auth/pinAuth.test.ts` | VERIFIED | 9 unit tests passing |
| `mobile/src/__tests__/features/auth/sessionExpiry.test.ts` | VERIFIED | 12 unit tests with fake timers passing |

### Plan 05 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `mobile/src/features/catalog/ProductGrid.tsx` | VERIFIED | FlatList 2-column with pull-to-refresh |
| `mobile/src/features/catalog/ProductTile.tsx` | VERIFIED | addItem wired to useCartStore, single/multi-variant logic |
| `mobile/src/features/catalog/VariantPicker.tsx` | VERIFIED | Inline picker with stock counts, zero-stock tappable |
| `mobile/src/features/cart/CartBar.tsx` | VERIFIED | Reads useCartStore items/total, visible when items > 0 |
| `mobile/src/features/cart/CartSheet.tsx` | VERIFIED | Quantity controls, Review Sale button |
| `mobile/src/features/cart/useSaleRecording.ts` | VERIFIED | recordSaleLocally wired, clearCart, pendingCount increment, no API calls |
| `mobile/src/app/selling/review.tsx` | VERIFIED | Payment method (4 options), currency (4 options), discount controls, grand total |
| `mobile/src/__tests__/features/catalog/productGrid.test.tsx` | VERIFIED | 9 tests passing |
| `mobile/src/__tests__/features/cart/saleRecording.test.ts` | VERIFIED | 5 tests passing |

### Plan 06 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `mobile/src/app/concerts/index.tsx` | VERIFIED | FlatList, status badges, + New button, pull-to-refresh |
| `mobile/src/app/concerts/[id].tsx` | VERIFIED | Start Selling, Close/Reopen, totals modal, price overrides |
| `mobile/src/app/concerts/new.tsx` | VERIFIED | 4-field validation form (name, venue, date, city) |
| `mobile/src/app/(tabs)/history.tsx` | VERIFIED | SectionList, concert grouping, VOIDED badges, filter dropdown |
| `mobile/src/app/history/[saleId].tsx` | VERIFIED | Full sale detail, void/unvoid buttons with confirm dialogs |
| `mobile/src/features/history/useHistory.ts` | VERIFIED | loadHistory, grouping/sorting, voidSale (stock + outbox), unvoidSale |
| `mobile/src/features/concerts/useConcerts.ts` | VERIFIED | loadConcerts (online/offline), createConcert, closeConcert (totals), reopenConcert |
| `mobile/src/__tests__/features/history/history.test.ts` | VERIFIED | 8 tests passing |

### Plan 07 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `mobile/src/features/sync/SyncManager.ts` | VERIFIED | requestSync, batching, backoff, concurrent guard, startPeriodicSync/stopPeriodicSync |
| `mobile/src/features/sync/useConnectivity.ts` | VERIFIED | NetInfo.addEventListener, offline→online requestSync trigger, syncStore.setIsOnline |
| `mobile/src/app/(tabs)/stock.tsx` | VERIFIED | Expandable rows (collapsed: total, expanded: per-variant), pull-to-refresh, Needs Reproduction section |
| `mobile/src/app/restock.tsx` | VERIFIED | 4-step wizard, internet gate, navigates back on success |
| `mobile/src/app/products/index.tsx` | VERIFIED | Product list, active/inactive badges, + button |
| `mobile/src/app/products/new.tsx` | VERIFIED | Dynamic variant add/remove form |
| `mobile/src/app/products/[id].tsx` | VERIFIED | Edit form, deactivate button |
| `mobile/src/__tests__/features/sync/syncManager.test.ts` | VERIFIED | 13 tests passing |
| `mobile/src/__tests__/features/stock/stock.test.ts` | VERIFIED | 8 tests passing |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `api/routes/auth.js` | `api/models/Admin.js` | bcrypt PIN hashing, admin.pinHash | WIRED | auth.js lines 154-156: bcrypt.hash stored on admin.pinHash; lines 181, 187: read/compare |
| `api/routes/concerts.js` | `api/models/Concert.js` | Mongoose CRUD operations | WIRED | concerts.js: Concert.find (line 12), Concert.create (line 33), Concert.findById (line 53), Concert.findByIdAndUpdate (line 78) |
| `api/index.js` | `api/routes/concerts.js` | Express route registration | WIRED | index.js line 25: `app.use('/api/concerts', require('./routes/concerts'))` |
| `api/routes/sales.js` | `api/models/Sale.js` | Sale.findOne, Sale.find, Sale.create | WIRED | sales.js lines 34, 112, 76: all three operations present |
| `api/routes/sales.js` | `api/models/Product.js` | Stock deduction via atomic $inc | WIRED | sales.js line 54: Product.findOneAndUpdate with $inc; lines 137, 171: void/unvoid reversals |
| `api/index.js` | `api/routes/sales.js` | Express route registration | WIRED | index.js line 26: `app.use('/api/sales', require('./routes/sales'))` |
| `mobile/src/db/outbox.ts` | `mobile/src/db/index.ts` | getDb() for database handle | WIRED | useSaleRecording.ts and useHistory.ts both call getDb() before passing db to outbox functions |
| `mobile/src/stores/cartStore.ts` | `react-native-mmkv` | MMKV storage adapter for Zustand | WIRED | cartStore.ts lines 3-10: createMMKV, mmkvStorage wrapper, createJSONStorage |
| `mobile/src/features/auth/pinAuth.ts` | `expo-secure-store` | SecureStore.setItemAsync/getItemAsync | WIRED | pinAuth.ts lines 21, 22, 30, 40 |
| `mobile/src/features/auth/useAuth.ts` | `mobile/src/stores/authStore.ts` | useAuthStore for auth state | WIRED | useAuth.ts lines 3, 18, 64: imported and used |
| `mobile/src/features/auth/useAuth.ts` | `mobile/src/features/auth/sessionExpiry.ts` | scheduleExpiryWarning/clearExpiryWarning on login/logout | WIRED | useAuth.ts lines 7, 31-37, 64-72, 82 |
| `mobile/src/api/client.ts` | `mobile/src/stores/authStore.ts` | JWT interceptor reads token from auth store | WIRED | client.ts line 30: `useAuthStore.getState().token` |
| `mobile/src/app/_layout.tsx` | `mobile/src/app/(auth)/pin.tsx` | Redirect when not authenticated | WIRED | _layout.tsx line 20: `{!isAuthenticated && <Redirect href="/(auth)/pin" />}` |
| `mobile/src/features/catalog/ProductTile.tsx` | `mobile/src/stores/cartStore.ts` | addItem on tile tap | WIRED | ProductTile.tsx line 25: useCartStore addItem, called on press |
| `mobile/src/features/cart/useSaleRecording.ts` | `mobile/src/db/outbox.ts` | recordSaleLocally for atomic write | WIRED | useSaleRecording.ts lines 4, 68: imported and called with db, sale, outboxEntry |
| `mobile/src/features/cart/CartBar.tsx` | `mobile/src/stores/cartStore.ts` | Reads items and total for display | WIRED | CartBar.tsx uses useCartStore items and total function |
| `mobile/src/features/sync/SyncManager.ts` | `mobile/src/db/outbox.ts` | getPendingOutboxRows + markOutboxDone | WIRED | SyncManager.ts lines 13-14, 47, 93, 127, 131 |
| `mobile/src/features/sync/SyncManager.ts` | `mobile/src/api/sales.ts` (via apiClient) | POST /api/sales/batch submission | WIRED | SyncManager.ts line 90: `apiClient.post('sales/batch', { sales })` |
| `mobile/src/features/sync/useConnectivity.ts` | `@react-native-community/netinfo` | NetInfo.addEventListener | WIRED | useConnectivity.ts line 20 |
| `mobile/src/features/stock/useStock.ts` | `mobile/src/api/inventory.ts` | Fetches stock from API when online | WIRED | useStock.ts lines 11, 31: apiGetStock imported and called in online branch |
| `mobile/src/features/history/useHistory.ts` | `mobile/src/db/sales.ts` | getLocalSales | WIRED | useHistory.ts lines 6, 45 |
| `mobile/src/app/history/[saleId].tsx` | `mobile/src/db/sales.ts` | voidLocalSale/unvoidLocalSale | WIRED | via useHistory hook which calls voidLocalSale/unvoidLocalSale (lines 98, 150) |
| `mobile/src/features/concerts/useConcerts.ts` | `mobile/src/api/concerts.ts` | API calls for concert CRUD when online | WIRED | useConcerts.ts lines 19, 51, 90, 135: apiGetConcerts, apiCreateConcert, apiPatchConcert |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| POS-01 | 02-02, 02-03, 02-05, 02-07 | User can record sales offline without internet | SATISFIED | SQLite + outbox pattern (outbox.ts), SyncManager processes queue when online |
| POS-02 | 02-05 | User can quickly select products with touch-friendly interface | SATISFIED | ProductGrid FlatList, ProductTile touch-friendly pressable, VariantPicker inline, minimum 44px targets |
| POS-03 | 02-02, 02-06 | User can view transaction history for current concert | SATISFIED | History tab SectionList grouped by concert, sale detail screen, concert CRUD |
| POS-04 | 02-07 | User can see real-time inventory levels that sync when online | SATISFIED | Stock tab with pull-to-refresh + auto-refresh on focus, useStock.refreshStock fetches from API |
| POS-05 | 02-01, 02-04 | User can authenticate with PIN or password | SATISFIED | PIN setup/login API endpoints (02-01), PIN entry screen + online/offline login flows (02-04) |
| POS-09 | 02-03, 02-05 | User can add multiple items to a single transaction | SATISFIED | cartStore supports multiple CartItems; CartSheet shows full item list with +/- controls |
| POS-10 | 02-03, 02-05 | App automatically calculates transaction total | SATISFIED | cartStore.total() with flat/percent discount math; review screen shows grand total |
| AUTH-01 | 02-01, 02-04 | Admin can log in to mobile POS app securely | SATISFIED | bcrypt PIN hash (API), SHA-256 offline hash (mobile), expo-secure-store storage, JWT 24h expiry |

**Requirements per REQUIREMENTS.md traceability table:** All 8 requirements assigned to Phase 2 verified as satisfied.

**Orphaned requirements:** None — all 8 requirements claimed by plans are mapped in REQUIREMENTS.md to Phase 2.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `mobile/src/app/explore.tsx` | Expo template scaffold leftover (181 lines, not referenced by any route in use) | Info | No functional impact — unreachable dead file, not exported or imported anywhere in the phase codebase |

No blocker or warning anti-patterns found. All key files have substantive implementations, not stubs. No TODO/FIXME/placeholder code comments in production files.

---

## Test Coverage Summary

| Test Suite | Tests | Status |
|-----------|-------|--------|
| API (all suites) | 114 | Passing |
| Mobile (all suites) | 84 | Passing |
| **Total** | **198** | **All passing** |

API test suites include: auth.test.js, concerts.test.js, inventory.test.js, inventory-stock.test.js, middleware-auth.test.js, models.test.js, pin-auth.test.js, products.test.js, products-put.test.js, sales-batch.test.js.

Mobile test suites include: outbox.test.ts, cartStore.test.ts, pinAuth.test.ts, sessionExpiry.test.ts, productGrid.test.tsx, saleRecording.test.ts, history.test.ts, stock.test.ts, syncManager.test.ts.

---

## Human Verification Required

The following items cannot be verified programmatically and require running the app on a device or simulator:

### 1. PIN Entry and Authentication Flow

**Test:** Open app on device, enter 4-6 digit PIN via numeric keypad
**Expected:** Digits display as filled dots, minimum 4 digits auto-submits, correct PIN navigates to Dashboard tab, wrong PIN shows alert "Wrong PIN" and clears
**Why human:** React Native rendering, touch event handling, and navigation transitions require a running app

### 2. Session Expiry Alert

**Test:** Login with a JWT that expires in 35 minutes, wait for ~5 minutes
**Expected:** Alert.alert fires with "Session Expiring" message 30 minutes before expiry
**Why human:** Requires waiting through real time (or mocking Date in a running app) — cannot observe Alert.alert in Jest without a running UI context

### 3. Selling Flow End-to-End

**Test:** Navigate to selling screen, tap a multi-variant product, select variant, add to cart, tap cart bar, tap Review Sale, confirm
**Expected:** Product grid shows with stock counts, variant picker opens inline, cart bar appears with count + total, review screen shows all fields, confirm clears cart and shows success toast
**Why human:** Full UI flow, BottomSheet rendering, SQLite write confirmation

### 4. Sync Indicator Live State

**Test:** Disable wifi/internet on device, observe dashboard, then re-enable
**Expected:** Red dot when offline, transitions to yellow while syncing, then green when synced
**Why human:** Requires connectivity toggling during active session

### 5. Offline-First Sync Round-Trip

**Test:** Go offline, record 3 sales via the POS flow, go online
**Expected:** Outbox processes, POST /api/sales/batch called with all 3 sales and their idempotency keys, pendingCount returns to 0
**Why human:** Requires device connectivity toggling and observing both SQLite state and network traffic

---

## Summary

Phase 02 goal is achieved. All 24 observable truths are verified against the actual codebase. Both the API layer (Plans 01-02) and the mobile app (Plans 03-07) are fully implemented with substantive, wired code — no stubs found.

**Key evidence of goal achievement:**
- 198 tests pass (114 API + 84 mobile), confirming all core behaviors work as designed
- Complete offline-first architecture: SQLite + outbox (Plan 03) → recording (Plan 05) → sync (Plan 07)
- Full auth chain: bcrypt PIN API (Plan 01) → SHA-256 hash + SecureStore (Plan 04) → JWT interceptor (Plan 04)
- Concert management and transaction history fully wired to both local SQLite and API
- SyncManager implements all required behaviors: batching, idempotency, exponential backoff (cap 30s), 3-failure alert threshold, concurrent guard

The one info-level finding (`explore.tsx` template leftover) has no impact on functionality — it is unreachable dead code from the Expo SDK 55 scaffold.

---

_Verified: 2026-03-14T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
