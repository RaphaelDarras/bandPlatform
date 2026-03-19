---
phase: 02-mobile-pos-core
plan: 09
subsystem: mobile
tags: [i18n, settings, offline-detection, sync, uat-fix]
dependency_graph:
  requires: []
  provides: [i18n-settings-screen, server-aware-connectivity]
  affects: [settings-screen, sync-indicator, syncStore]
tech_stack:
  added: []
  patterns: [zustand-partialize, netinfo-consecutive-failures]
key_files:
  created: []
  modified:
    - mobile/src/app/(tabs)/settings.tsx
    - mobile/src/i18n/en.json
    - mobile/src/i18n/fr.json
    - mobile/src/stores/syncStore.ts
    - mobile/src/features/sync/useConnectivity.ts
decisions:
  - "partialize in syncStore excludes isOnline from MMKV — cold start always defaults to false, no stale online state survives restart"
  - "consecutiveFailures threshold of 3 used in NetInfo listener — simpler than store subscription, converges within one 60s sync cycle"
metrics:
  duration: 2min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 2 Plan 09: UAT Bug Fixes — i18n Settings and Server-Aware Offline Detection Summary

**One-liner:** i18n-enabled settings screen with all labels translatable, plus server-reachability offline detection via consecutiveFailures threshold and non-persisted isOnline state.

## What Was Built

Two UAT bugs from tests 20 and 21 were fixed:

**Bug 1 (UAT test 20) — Language toggle had no effect on settings screen labels:**
The settings screen had 8 hardcoded English strings that bypassed i18n. `i18n.changeLanguage()` was wired correctly but the rendered text was never going through `t()`. Fixed by:
- Adding a `settings.*` section to `en.json` with 9 keys (language, french, appearance, darkMode, security, changePin, about, version, logoutConfirm)
- Adding matching French translations to `fr.json`
- Replacing every hardcoded string in `settings.tsx` with the corresponding `t('settings.*')` call

**Bug 2 (UAT test 21) — Sync indicator showed online when API server was unreachable:**
Two root causes: (1) NetInfo only checks device-level connectivity — if WiFi is connected but the API server is down, `isOnline` stayed true. (2) `isOnline` was persisted to MMKV, so a stale "online" value survived app restarts. Fixed by:
- Adding `partialize` to the syncStore persist config to exclude `isOnline` — it now defaults to `false` on every cold start
- Updating `useConnectivitySync` to read `consecutiveFailures` from the store inside the NetInfo listener; if the device has network but 3+ sync failures have accumulated, `isOnline` is set to `false`

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | afdedb8 | feat(02-09): replace hardcoded strings in settings screen with i18n t() calls |
| 2 | b521b6f | fix(02-09): fix offline detection — server reachability via consecutiveFailures, volatile isOnline |

## Deviations from Plan

None - plan executed exactly as written.

The plan noted that `subscribeWithSelector` middleware might be needed for reactive store subscription, but suggested the simpler approach (check `consecutiveFailures` inside the NetInfo listener) was acceptable. The simpler approach was implemented as recommended.

## Self-Check

- [x] `mobile/src/app/(tabs)/settings.tsx` — modified, all hardcoded strings replaced with `t()` calls
- [x] `mobile/src/i18n/en.json` — modified, `settings.*` section added
- [x] `mobile/src/i18n/fr.json` — modified, `settings.*` section added in French
- [x] `mobile/src/stores/syncStore.ts` — modified, `partialize` excludes `isOnline`
- [x] `mobile/src/features/sync/useConnectivity.ts` — modified, `consecutiveFailures` check added
- [x] Commit afdedb8 exists
- [x] Commit b521b6f exists
- [x] TypeScript compilation passes (no errors)

## Self-Check: PASSED
