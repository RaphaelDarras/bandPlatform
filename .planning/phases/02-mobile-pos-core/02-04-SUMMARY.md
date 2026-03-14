---
phase: 02-mobile-pos-core
plan: 04
subsystem: auth
tags: [expo, react-native, pin-auth, jwt, axios, expo-secure-store, expo-crypto, session-expiry, nativewind, tabs]

# Dependency graph
requires:
  - phase: 02-mobile-pos-core-01
    provides: API endpoints POST /auth/pin-login, /auth/pin-setup, /auth/verify
  - phase: 02-mobile-pos-core-03
    provides: authStore, syncStore, cartStore Zustand stores; i18n setup; jest test infrastructure
provides:
  - PIN authentication (SHA-256 hash via expo-crypto, stored in expo-secure-store)
  - Online login flow (API call + local PIN hash + JWT storage)
  - Offline login flow (PIN hash comparison + cached JWT)
  - Axios apiClient with Bearer JWT interceptor and 401 clearAuth handler
  - useAuth hook (login/logout/isAuthenticated/isLoading)
  - Session expiry warning alert 30 minutes before JWT exp
  - Root layout with auth guard (redirects to PIN screen when not authenticated)
  - PIN entry screen with numeric keypad and offline cold-start message
  - JS Tabs navigation (4 tabs: Dashboard, History, Stock, Settings)
  - Dashboard with 7 quick action cards and sync status indicator
  - Settings screen with FR/EN language toggle, dark/light theme toggle, logout
affects:
  - 02-mobile-pos-core (all subsequent screens depend on auth and tab shell)
  - selling flow, concert management, history, stock screens

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED-GREEN pattern for auth logic (test file committed before implementation)
    - Dynamic import avoided for sessionExpiry — static import used for tree-shakability and TS correctness
    - i18n.t() used directly in feature hooks (not useTranslation hook) — hooks can only run in React components
    - scheduleExpiryWarning returns cleanup function — caller responsible for clearing previous timer

key-files:
  created:
    - mobile/src/features/auth/pinAuth.ts
    - mobile/src/features/auth/useAuth.ts
    - mobile/src/features/auth/sessionExpiry.ts
    - mobile/src/api/client.ts
    - mobile/src/api/auth.ts
    - mobile/src/app/_layout.tsx
    - mobile/src/app/(auth)/pin.tsx
    - mobile/src/app/(tabs)/_layout.tsx
    - mobile/src/app/(tabs)/index.tsx
    - mobile/src/app/(tabs)/settings.tsx
    - mobile/src/app/(tabs)/history.tsx
    - mobile/src/app/(tabs)/stock.tsx
    - mobile/src/__tests__/features/auth/pinAuth.test.ts
    - mobile/src/__tests__/features/auth/sessionExpiry.test.ts
  modified:
    - mobile/src/i18n/en.json (added auth.sessionExpiring, auth.sessionExpiringMessage)
    - mobile/src/i18n/fr.json (added French equivalents)

key-decisions:
  - "sessionExpiry.ts created ahead of Task 3 to allow TypeScript to compile during Task 2 — implementation completed in same plan"
  - "JS Tabs used (not NativeTabs) per plan spec — NativeTabs is alpha and cannot hide tab bar for selling mode"
  - "useAuth uses static import of sessionExpiry (not dynamic import) — removes async complexity and TS errors"
  - "i18n.t() used directly in useAuth hook (not useTranslation) — hook is a plain function, not a React component"
  - "Tab bar hidden when cartStore.concertId !== null (selling mode) — reads directly from Zustand state"
  - "No PIN lockout — unlimited attempts per plan spec (concert use case, user is the trusted band member)"

patterns-established:
  - "TDD for auth logic: test file committed (RED) before implementation (GREEN)"
  - "Auth guard in root _layout.tsx using Redirect from expo-router"
  - "Session expiry: scheduleExpiryWarning returns cleanup fn, clearExpiryWarning for module-level cancellation"

requirements-completed: [POS-05, AUTH-01]

# Metrics
duration: 15min
completed: 2026-03-14
---

# Phase 2 Plan 4: PIN Auth Flow, Tab Navigation, and Session Expiry Summary

**PIN-based authentication with SHA-256 offline hash verification, Axios JWT client, 4-tab JS navigation shell, dashboard with quick actions, and 30-minute session expiry warning**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-14T14:30:38Z
- **Completed:** 2026-03-14T14:45:18Z
- **Tasks:** 3 completed (2 TDD, 1 standard)
- **Files modified:** 16

## Accomplishments
- Full PIN auth flow: online (API call) + offline (local hash comparison) with expo-secure-store and expo-crypto SHA-256
- Axios API client with request interceptor (injects Bearer token) and response interceptor (clears auth on 401)
- Session expiry warning fires 30 minutes before JWT exp using base64url-decoded JWT payload; fires immediately if < 30 min remaining
- Root layout auth guard redirects to PIN screen when unauthenticated; JS Tabs with 4 tabs that hide in selling mode
- Dashboard with 7 quick action cards in 2-column responsive grid with live sync status indicator
- Settings screen with FR/EN language switch and dark/light theme toggle via Appearance API

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: PIN auth tests** - `9bc1215` (test)
2. **Task 1 GREEN: PIN auth, API client, auth hook** - `f0191ae` (feat)
3. **Task 2: Root layout, PIN screen, tabs, dashboard, settings** - `6ee5ad9` (feat)
4. **Task 3: Session expiry warning + useAuth integration** - `b453cad` (feat)

_Note: TDD tasks have separate test (RED) and implementation (GREEN) commits._

## Files Created/Modified
- `mobile/src/features/auth/pinAuth.ts` - hashPin, setupPinLocally, verifyPinOffline, getCachedToken
- `mobile/src/features/auth/useAuth.ts` - login/logout hook with online/offline paths and session expiry
- `mobile/src/features/auth/sessionExpiry.ts` - parseJwtExp, scheduleExpiryWarning, clearExpiryWarning
- `mobile/src/api/client.ts` - Axios instance with Bearer token interceptor and 401 handler
- `mobile/src/api/auth.ts` - apiPinLogin, apiPinSetup, apiVerifyToken
- `mobile/src/app/_layout.tsx` - Root layout with auth guard (Redirect when !isAuthenticated)
- `mobile/src/app/(auth)/pin.tsx` - Numeric keypad PIN entry, offline cold-start message
- `mobile/src/app/(tabs)/_layout.tsx` - JS Tabs, 4 tabs, selling mode tab hiding
- `mobile/src/app/(tabs)/index.tsx` - Dashboard with 7 action cards and sync indicator
- `mobile/src/app/(tabs)/settings.tsx` - Language toggle, theme toggle, logout
- `mobile/src/app/(tabs)/history.tsx` - Placeholder screen
- `mobile/src/app/(tabs)/stock.tsx` - Placeholder screen
- `mobile/src/__tests__/features/auth/pinAuth.test.ts` - 9 unit tests for PIN auth logic
- `mobile/src/__tests__/features/auth/sessionExpiry.test.ts` - 12 unit tests with fake timers
- `mobile/src/i18n/en.json` - Added sessionExpiring and sessionExpiringMessage keys
- `mobile/src/i18n/fr.json` - Added French session expiry translations

## Decisions Made
- JS Tabs used (not NativeTabs) — NativeTabs is alpha and cannot hide tab bar for selling mode
- useAuth uses static import of sessionExpiry (not dynamic import) — removes async complexity and TypeScript errors
- `i18n.t()` used directly in useAuth hook (not `useTranslation`) — hook is a plain function, not a React component
- Tab bar hidden when `cartStore.concertId !== null` (selling mode) — reads Zustand state directly
- No PIN lockout implemented per plan spec (band member trusted user, concert emergency use case)
- sessionExpiry.ts created during Task 2 ahead of Task 3 to allow TypeScript compilation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created sessionExpiry.ts stub during Task 2**
- **Found during:** Task 2 (TypeScript check failed because useAuth imports sessionExpiry)
- **Issue:** useAuth.ts imports from ./sessionExpiry but file didn't exist yet (scheduled for Task 3)
- **Fix:** Created full sessionExpiry.ts implementation during Task 2 instead of a stub — task 3 then added tests against the already-working implementation
- **Files modified:** mobile/src/features/auth/sessionExpiry.ts
- **Verification:** TypeScript compiled cleanly; all 12 sessionExpiry tests passed
- **Committed in:** 6ee5ad9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking issue — missing required file)
**Impact on plan:** Necessary to avoid TypeScript compilation failure. All three tasks completed as specified. No scope creep.

## Issues Encountered
- Jest 30 requires `--testPathPatterns` flag (not `--testPathPattern`) — used correct flag throughout

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth entry gate complete: PIN screen, online + offline login, session expiry
- 4-tab navigation shell ready for subsequent feature screens (selling, concerts, history, stock)
- API client with JWT interceptor ready for all authenticated API calls
- All 41 unit tests passing; TypeScript compiles cleanly

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
