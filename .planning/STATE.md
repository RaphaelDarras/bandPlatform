---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-mobile-pos-core-07-PLAN.md
last_updated: "2026-03-14T15:46:12.257Z"
last_activity: "2026-03-14 — Completed Plan 02-05: Selling Flow (product grid, variant picker, cart, atomic sale recording)"
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 13
  completed_plans: 13
  percent: 77
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Band members can record merchandise sales at concerts quickly and reliably, with stock automatically synchronized across online and physical sales channels, preventing overselling and lost revenue.
**Current focus:** Phase 1 - Foundation & Inventory Core

## Current Position

Phase: 2 of 7 (Mobile POS Core)
Plan: 5 of 7 in current phase (02-05 complete)
Status: Executing
Last activity: 2026-03-14 — Completed Plan 02-05: Selling Flow (product grid, variant picker, cart, atomic sale recording)

Progress: [████████░░] 77%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 2 minutes
- Total execution time: 0.07 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 4 min | 2 min |
| Phase 01 P03 | 3 | 3 tasks | 6 files |
| Phase 01 P04 | 1 | 1 tasks | 2 files |
| Phase 01 P05 | 2 | 1 tasks | 3 files |
| Phase 01 P06 | 5 | 1 tasks | 2 files |
| Phase 02 P01 | 5 | 2 tasks | 9 files |
| Phase 02-mobile-pos-core P02 | 2 | 2 tasks | 3 files |
| Phase 02-mobile-pos-core P03 | 14min | 3 tasks | 23 files |
| Phase 02-mobile-pos-core P04 | 15min | 3 tasks | 16 files |
| Phase 02-mobile-pos-core P05 | 14min | 2 tasks | 12 files |
| Phase 02 P06 | 14 | 2 tasks | 11 files |
| Phase 02-mobile-pos-core P07 | 17 | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- MongoDB vs PostgreSQL decision pending (roadmap suggests PostgreSQL for ACID compliance)
- 5-collection data model decision pending
- JWT authentication decision pending
- [Phase 01]: Per-variant version field for optimistic locking - allows concurrent updates to different sizes/colors
- [Phase 01]: Embedded variants in Product collection - simpler queries following MongoDB design
- [Phase 01]: Inventory audit trail in Order items (stockBefore/stockAfter) - no separate Inventory collection
- [Phase 01]: Use bcrypt with salt rounds of 10 for password hashing (industry standard)
- [Phase 01]: JWT middleware extracts Bearer token from Authorization header
- [Phase 01]: POST /deduct creates Order or Sale documents with stockBefore/stockAfter for audit trail (no separate Inventory collection)
- [Phase 01]: Reserve/release endpoints modify stock but don't create audit entries (temporary holds only)
- [Phase 01]: InventoryAdjustment stores productId as top-level field (not nested in items array), so no unwind needed in audit aggregation
- [Phase 01]: Use allowedProductFields and allowedVariantFields arrays for explicit $set whitelisting — prevents any future field slipping through untested
- [Phase 01]: Return 400 for PUT body with no recognized fields rather than silently accepting no-ops
- [Phase 01]: Return productCount alongside grandTotal and products array for convenience (avoids client-side array length calculation)
- [Phase 01]: Use Product.find({ active: true }).lean() for read-only stock query (no Mongoose document overhead)
- [Phase 02-01]: pinHash stored verbatim in Admin model — PIN hashing done in route handler to avoid double-hashing risk
- [Phase 02-01]: Sparse unique index on idempotencyKey allows many null values but enforces uniqueness when set
- [Phase 02-01]: city request field maps to location DB field in Concert creation — matches mobile app naming
- [Phase 02-01]: PIN login uses Admin.findOne({ active: true }) — assumes single active admin for band mobile POS
- [Phase 02-02]: Batch processes sales sequentially to allow per-item idempotency check and stock reads before insert
- [Phase 02-02]: Stock can go negative on batch submit — concert sales never rejected (no floor validation)
- [Phase 02-mobile-pos-core]: MMKV v4.2.0 installed (not v3.x as researched) — API changed to createMMKV() function and remove() method; stores updated
- [Phase 02-mobile-pos-core]: Expo SDK 55 WinterCG runtime requires moduleNameMapper mock for Jest 30 — installGlobal lazy getter triggers scope guard
- [Phase 02-mobile-pos-core]: Babel config conditionally disables NativeWind/Reanimated plugins in test env (NODE_ENV=test) to prevent jest transform errors
- [Phase 02-mobile-pos-core]: JS Tabs used (not NativeTabs) — NativeTabs is alpha and cannot hide tab bar for selling mode
- [Phase 02-mobile-pos-core]: sessionExpiry.ts created during Task 2 (not Task 3) to allow TypeScript compilation — full implementation completed in same plan
- [Phase 02-mobile-pos-core]: useAuth uses i18n.t() directly (not useTranslation hook) — hook is a plain function, not a React component
- [Phase 02-05]: VariantPicker rendered inline (not BottomSheet) — simpler to test, avoids nested sheet issues
- [Phase 02-05]: getByLabelText used in RTL tests for variant rows — getByA11yLabel does not exist in @testing-library/react-native v13
- [Phase 02-06]: useConcerts.closeConcert calculates totals from local SQLite sales (not API) — offline-first, no network dependency for totals
- [Phase 02-06]: useHistory void/unvoid create outbox entries via db.runAsync directly (not recordSaleLocally) — void is a separate operation type, not a new sale
- [Phase 02-06]: LocalSaleRow total_amount: accessed via cast to Record<string, number> since SQLite returns snake_case but TypeScript type uses camelCase totalAmount
- [Phase 02-mobile-pos-core]: _resetSyncState export for test isolation of module-level syncInProgress singleton — avoids jest.resetModules() overhead
- [Phase 02-mobile-pos-core]: useSyncStore.getState mock must be restored after jest.clearAllMocks() in beforeEach — clearAllMocks removes mockReturnValue implementations
- [Phase 02-mobile-pos-core]: useStock reads from local cache after API upsert — cache is always source of truth for offline-first consistency

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 Critical:**
- Race condition prevention requires atomic inventory operations from day one (cannot be retrofitted)
- Database choice (MongoDB vs PostgreSQL) affects inventory transaction approach
- Research recommends PostgreSQL for ACID guarantees on concurrent transactions

**Timeline:**
- Concert sales tool must be operational by early April (Phase 2 + Phase 3 critical path)
- 8-12 hours per week development time available

## Session Continuity

Last session: 2026-03-14T15:46:12.252Z
Stopped at: Completed 02-mobile-pos-core-07-PLAN.md
Resume file: None

---
*Created: 2026-02-13*
*Last updated: 2026-03-12T19:55:19Z after completing Plan 01-01*
