---
phase: 02-mobile-pos-core
plan: 03
subsystem: mobile
tags: [expo, react-native, sqlite, zustand, mmkv, nativewind, i18n, jest, offline-first]

# Dependency graph
requires: []
provides:
  - Expo SDK 55 mobile project with all dependencies installed
  - SQLite database with WAL mode (getDb singleton, migrations)
  - Outbox pattern for atomic offline-safe sale recording
  - Cart store with MMKV persistence and correct discount math
  - Auth store and Sync store with MMKV persistence
  - i18n with French/English translations (i18next)
  - Jest test infrastructure with native module mocks
  - 20 passing unit tests (outbox + cartStore)
affects: [02-04, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added:
    - expo@55.0.6
    - expo-sqlite@55.0.10
    - expo-router@55.0.5
    - react-native-mmkv@4.2.0 (v4 — createMMKV API, not new MMKV())
    - react-native-nitro-modules@0.35.1
    - zustand@5.0.11
    - nativewind@4.2.2
    - tailwindcss@3.4.19
    - i18next + react-i18next
    - axios@1.13.6, date-fns@4.1.0, uuid@13.0.0
    - jest@30.3.0, jest-expo@55.0.9
    - @testing-library/react-native@13.3.3
    - @gorhom/bottom-sheet@5.2.8
    - react-native-reanimated@4.2.1
    - @react-native-community/netinfo@11.5.2
  patterns:
    - SQLite WAL mode singleton via getDb()
    - Outbox pattern: atomic sale+outbox write in withTransactionAsync
    - Zustand + MMKV persist middleware for offline-safe state
    - Test environment: WinterCG runtime mock for Expo SDK 55 + Jest 30 compatibility
    - Babel: skip NativeWind/Reanimated plugins in test environment via NODE_ENV check

key-files:
  created:
    - mobile/package.json
    - mobile/app.json
    - mobile/tsconfig.json
    - mobile/tailwind.config.js
    - mobile/jest.config.js
    - mobile/jest.setup.js
    - mobile/babel.config.js
    - mobile/global.css
    - mobile/src/db/index.ts
    - mobile/src/db/migrations.ts
    - mobile/src/db/outbox.ts
    - mobile/src/db/sales.ts
    - mobile/src/stores/cartStore.ts
    - mobile/src/stores/authStore.ts
    - mobile/src/stores/syncStore.ts
    - mobile/src/i18n/index.ts
    - mobile/src/i18n/en.json
    - mobile/src/i18n/fr.json
    - mobile/src/__tests__/db/outbox.test.ts
    - mobile/src/__tests__/stores/cartStore.test.ts
    - mobile/src/__mocks__/expo-winter-runtime.js
  modified:
    - package.json (added test:all script)

key-decisions:
  - "MMKV v4.2.0 installed (not v3.x as researched) — API changed to createMMKV() function and remove() method; stores updated accordingly"
  - "Babel config conditionally disables NativeWind/Reanimated plugins in test env (NODE_ENV=test) to prevent jest transform errors"
  - "Expo SDK 55 WinterCG runtime requires moduleNameMapper mock for Jest 30 — installGlobal lazy getter triggers scope guard"
  - "jest types added to tsconfig 'types' array to enable describe/it/expect globals in TypeScript"
  - "Task 3 (expo prebuild) is a human-action checkpoint — cannot be automated, requires user to run npx expo prebuild locally"

patterns-established:
  - "Pattern: SQLite singleton — getDb() caches db instance, enables WAL, runs migrations on first open"
  - "Pattern: Outbox atomicity — withTransactionAsync writes sale + outbox row simultaneously; INSERT OR IGNORE prevents duplicates"
  - "Pattern: MMKV storage adapter — createMMKV per store, wrapped in {getItem, setItem, removeItem} for Zustand createJSONStorage"
  - "Pattern: Jest + Expo SDK 55 — mock expo/src/winter to prevent WinterCG runtime scope errors; disable NativeWind babel in test env"

requirements-completed: [POS-01, POS-09, POS-10]

# Metrics
duration: 13min
completed: 2026-03-14
---

# Phase 2 Plan 3: Mobile Foundation — Expo Project, SQLite Outbox, Zustand Stores Summary

**Expo SDK 55 mobile project scaffolded with SQLite WAL-mode outbox, MMKV-persisted Zustand stores, NativeWind v4, i18next FR/EN, 20 passing unit tests, and Android native build artifacts generated via expo prebuild**

## Performance

- **Duration:** 13 min (code) + human checkpoint (prebuild)
- **Started:** 2026-03-14T13:22:57Z
- **Completed:** 2026-03-14
- **Tasks:** 3/3
- **Files modified:** 22 + android/ directory (generated)

## Accomplishments
- Created mobile/ Expo SDK 55 project with all required dependencies installed
- Built SQLite data layer: WAL mode, migrations for 5 tables, outbox pattern with atomic transaction
- Built 3 Zustand stores (cart, auth, sync) with MMKV persistence using createMMKV() (v4 API)
- Configured i18next with English and French translations
- Set up Jest infrastructure with native module mocks; resolved Expo SDK 55 + Jest 30 WinterCG compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Expo project with all dependencies and configuration** - `35623d4` (chore)
2. **Task 2: SQLite data layer with outbox pattern and Zustand stores** - `4c82acf` (feat)

3. **Task 3: Run expo prebuild for native module support** - checkpoint:human-action (user ran `npx expo prebuild`; android/ directory generated successfully)

## Files Created/Modified
- `mobile/package.json` — Expo SDK 55 dependencies, test script
- `mobile/app.json` — BandPOS name, band-pos slug, bandpos scheme, portrait lock
- `mobile/babel.config.js` — NativeWind + Reanimated plugins (disabled in test env)
- `mobile/tailwind.config.js` — NativeWind v4 preset configuration
- `mobile/jest.config.js` — jest-expo preset, WinterCG mock, @/* alias
- `mobile/jest.setup.js` — mocks for expo-sqlite, MMKV, NetInfo, expo-secure-store
- `mobile/src/db/index.ts` — getDb() singleton with WAL mode
- `mobile/src/db/migrations.ts` — 5 table schemas with indexes
- `mobile/src/db/outbox.ts` — recordSaleLocally (atomic), getPendingOutboxRows, markOutboxDone, incrementAttempt
- `mobile/src/db/sales.ts` — getLocalSales, voidLocalSale, unvoidLocalSale
- `mobile/src/stores/cartStore.ts` — cart with total() flat/percent discount math
- `mobile/src/stores/authStore.ts` — auth token persistence
- `mobile/src/stores/syncStore.ts` — online/pending/failures tracking
- `mobile/src/i18n/index.ts, en.json, fr.json` — i18next bilingual translations
- `mobile/src/__tests__/db/outbox.test.ts` — 7 outbox unit tests
- `mobile/src/__tests__/stores/cartStore.test.ts` — 13 cart store unit tests
- `package.json` — added test:all script

## Decisions Made
- MMKV v4.2.0 API: npm resolved v4 instead of v3; `createMMKV()` replaces `new MMKV()`, `remove()` replaces `delete()`. Updated all stores and mocks accordingly.
- Babel test env: NativeWind and Reanimated babel plugins cannot run in Jest (Babel transform conflict). Using `process.env.NODE_ENV === 'test'` to skip them.
- WinterCG runtime mock: Expo SDK 55 registers lazy getters on `global` via `installGlobal`. When accessed during test execution (not load time), Jest's module scope guard fires. Fixed by mapping `expo/src/winter*` imports to a no-op module in `moduleNameMapper`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MMKV v4.x API — createMMKV() instead of new MMKV()**
- **Found during:** Task 2 (store implementation)
- **Issue:** Plan specified `react-native-mmkv` v3.x with `new MMKV({ id })` constructor and `delete()` method. npm resolved v4.2.0 which exports only `createMMKV()` function and uses `remove()` not `delete()`
- **Fix:** Updated all 3 stores to use `createMMKV({ id })` and `remove()`; updated jest.setup.js mock accordingly
- **Files modified:** src/stores/cartStore.ts, src/stores/authStore.ts, src/stores/syncStore.ts, jest.setup.js
- **Verification:** TypeScript compiles, 20 tests pass
- **Committed in:** 4c82acf

**2. [Rule 3 - Blocking] Expo SDK 55 + Jest 30 WinterCG runtime scope error**
- **Found during:** Task 2 (first test run)
- **Issue:** `expo/src/winter/installGlobal` registers lazy getters on global. When Jest imports code that triggers these getters during test execution, Jest's module scope guard throws "You are trying to import a file outside of the scope of the test code"
- **Fix:** Added moduleNameMapper entries for `expo/src/winter*` pointing to a no-op mock file
- **Files modified:** jest.config.js, src/__mocks__/expo-winter-runtime.js
- **Verification:** Both test suites run without scope errors
- **Committed in:** 4c82acf

**3. [Rule 3 - Blocking] Babel config causes jest transform error with NativeWind plugin**
- **Found during:** Task 2 (first test run)
- **Issue:** `nativewind/babel` plugin is not compatible with Jest's babel transform (`.plugins is not a valid Plugin property`)
- **Fix:** Conditionally disable NativeWind and Reanimated plugins when `NODE_ENV === 'test'`
- **Files modified:** babel.config.js
- **Verification:** Tests run without babel errors
- **Committed in:** 4c82acf

**4. [Rule 1 - Bug] Missing CSS module type declaration for template web component**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Template-generated `animated-icon.web.tsx` imports `./animated-icon.module.css` with no type declaration
- **Fix:** Created `animated-icon.module.css.d.ts` with default export type
- **Files modified:** src/components/animated-icon.module.css.d.ts
- **Committed in:** 35623d4

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and functionality. MMKV v4 fix is a minor API adaptation, not a breaking change to architecture.

## Issues Encountered
- jest-expo@55.0.9 includes `jest-expo/src/preset/setup.js` which calls `require('expo/src/winter')`, triggering the WinterCG runtime lazy getter issue. Fixed via moduleNameMapper.
- `@testing-library/react-native` had a peer dependency conflict requiring `--legacy-peer-deps`; this is a known issue with Jest 30.

## User Setup Required

To run the app on an Android emulator or device, the developer needs:
1. Android Studio installed with Android SDK
2. `JAVA_HOME` environment variable pointing to JDK 17+
3. `ANDROID_HOME` environment variable pointing to Android SDK
4. Run `npx expo run:android` from the `mobile/` directory

Note: expo prebuild has completed — android/ directory exists. Gradle build failed due to missing JAVA_HOME/Gradle environment on Windows dev machine. This is a local environment concern deferred to when Android SDK environment is configured.

## Next Phase Readiness
- All 3 tasks complete: mobile foundation layer is fully ready
- android/ directory generated — native modules (MMKV, expo-sqlite, expo-secure-store) are linked
- 02-04 (PIN auth screen) and all subsequent wave 2 plans can proceed
- 20 unit tests passing provide regression safety for data layer
- Gradle/Android emulator setup needed before end-to-end testing on a device

---
*Phase: 02-mobile-pos-core*
*Completed: 2026-03-14*
