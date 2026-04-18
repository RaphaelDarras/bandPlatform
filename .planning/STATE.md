---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 02-mobile-pos-core-02-09-PLAN.md
last_updated: "2026-03-19T20:46:33.496Z"
last_activity: 2026-03-18 — Post-Phase 2 production bug fixes and feature additions
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 18
  completed_plans: 18
  percent: 77
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Band members can record merchandise sales at concerts quickly and reliably, with stock automatically synchronized across online and physical sales channels, preventing overselling and lost revenue.
**Current focus:** Phase 3 - Mobile POS Optimization (not yet planned)

## Current Position

Phase: 2 of 7 complete. Phase 3 not yet planned.
Status: Ready to plan Phase 3
Last activity: 2026-04-19 — Completed quick task 260419-1uj: Add Active/Closed tabs to concert management list

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
| Phase 03-mobile-pos-optimization P01 | 3 | 2 tasks | 7 files |
| Phase 03-mobile-pos-optimization P02 | 4min | 2 tasks | 3 files |
| Phase 03-mobile-pos-optimization P03 | 2 | 1 tasks | 4 files |
| Phase 02-mobile-pos-core P08 | 2min | 2 tasks | 4 files |
| Phase 02-mobile-pos-core P09 | 2min | 2 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- 2026-04-18: Phase 8 added: Immutable sale line snapshots (snapshot product name + variant label on sale items; one-time migration for historical sales). Driven by user report that removing a variant caused concert breakdowns to render raw SKU strings.
- 2026-04-19: Phase 9 added: Concert-first selling UX (make concert-linked sales the default fast path from dashboard; lone sale becomes rare explicit fallback). Driven by user observation that lone sales almost never happen in practice and the Concerts → list → detail → Start Selling detour is too slow. Open design questions parked in the phase goal for discuss-phase: single-active auto-select, multi-active picker shape, zero-active fallback, and lone-sale entry-point location.
- 2026-04-19: Phase 10 added: Design polish pass (lift mobile app from functional prototype to professional product). Driven by user observation that emoji icons, hardcoded hex colors, ad-hoc font sizes, and minimal interaction feedback make the app feel unfinished. Open design questions parked for discuss-phase: icon library choice, design tokens structure, typography scale shape, scope (all screens vs. dashboard+selling first), and dark-mode audit depth. Should be sequenced AFTER Phase 9 so the final dashboard layout is what gets polished.
- 2026-04-19: Phase 11 added: Multi-tenant band-agnostic platform (convert single-tenant Hurakan product into a platform any band can sign up for). Driven by user intent to make the platform available to other bands. ⚠ Scope almost certainly milestone-sized (touches DB schema, API auth, mobile app, upcoming e-shop, provisioning, domain routing, possibly billing) — discuss-phase should either aggressively cut scope or promote to v2.0 milestone. Critical open question: retrofit multi-tenancy after Phase 7 online-shop work ships, OR block Phases 4-7 and build them multi-tenant from day one (likely cheaper long-term but delays first online-shop value).

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

- [Phase 02-post]: SyncManager was never wired up in _layout.tsx — startPeriodicSync, useConnectivitySync added to root layout
- [Phase 02-post]: POST /sales/batch payload was wrapped in { sales: [...] } but backend expects plain array — fixed to send array directly
- [Phase 02-post]: paymentMethod sent as "Cash"/"Card" etc. but backend enum expects lowercase — normalised in SyncManager and useSaleRecording
- [Phase 02-post]: concertId sent as "" (empty string) to backend ObjectId field — causes 500 CastError; fix: omit concertId when empty, backend Sale.concertId set to required: false
- [Phase 02-post]: getDb() had no concurrent-open guard — multiple callers opened separate SQLite connections causing Android NullPointerException; fixed with promise-based singleton + connection health check
- [Phase 02-post]: apiClient response interceptor only cleared auth on 401; backend returns 403 for expired tokens — added 403 handling to interceptor
- [Phase 02-post]: refreshStock and loadProducts gated behind isOnline/NetInfo which returns null on Android until probe completes — removed gate, let API fail naturally and fall back to SQLite
- [Phase 02-post]: useStock merge logic used boolean hasPendingSales switch (all local or all API) — replaced with per-variant delta: displayStock = apiStock - sum(pending outbox quantities); handles crashes and restocks correctly
- [Phase 02-post]: SyncManager estimated remaining pending count by subtracting attempted (not succeeded) rows — falsely showed Online after failed sync; fixed to re-query actual DB count
- [Phase 02-post]: /inventory/restock used optimistic locking (version field match) but products created before version field was added have no version in MongoDB — $elemMatch never matches, all restocks return 409; fixed by removing version check, using plain $inc
- [Phase 02-post]: concert_id SQLite column returned as snake_case but TypeScript interface declared camelCase concertId — all history grouping/display used undefined; fixed with (row as unknown as { concert_id }).concert_id cast
- [Phase 02-post]: CachedConcert had no name field (removed in schema migration) — history used c.name which was always undefined; replaced with concertLabel(c) helper building label from venue/city/country/date
- [Phase 02-post]: cartStore.clearCart() did not reset currency — next sale after a non-EUR sale inherited previous currency; fixed by resetting to EUR in clearCart
- [Phase 02-post]: History filter dropdown derived concert options from salesByGroup (filtered state) — options disappeared when filter was active; fixed by tracking allConcertIds separately in useHistory, populated only on unfiltered load
- [Phase 02-post]: Selling screen used useEffect for product load — didn't reload on navigation back after sale; replaced with useFocusEffect
- [Phase 02-post]: Dashboard used useEffect for refreshStock — badge/alert never updated when returning to dashboard; replaced with useFocusEffect
- [Phase 02-post]: review.tsx router.back() after sale confirmation landed on selling/index instead of dashboard; replaced with router.dismiss(2) + setConcertId(null)
- [Phase 02-post]: Sale PATCH endpoint used findByIdAndUpdate with local UUID (not MongoDB _id) — CastError; fixed to findOneAndUpdate by idempotencyKey: "sale_create:{saleId}"
- [Phase 02-post]: priceAdjustment moved out of product management — it is now a concert-context concern only (concert price overrides); product create/edit always sends priceAdjustment: 0
- [Phase 02-post]: Concert model now has currency field (default EUR); selling from a concert sets cart currency from concert.currency; clearCart resets to EUR for no-concert sales
- [Phase 03-mobile-pos-optimization]: stockColor thresholds: <=0 red, <5 orange, >=5 gray — applied via inline style override on stock text elements
- [Phase 03-mobile-pos-optimization]: POS-06 and POS-11 closed with documentation comments in SyncManager.ts — no code changes needed
- [Phase 03-mobile-pos-optimization]: getConcertReport is a standalone exported function (not hook-only) — enables unit testing without renderHook overhead
- [Phase 03-mobile-pos-optimization]: Payment breakdowns grouped by (method.toLowerCase(), currency) pair — same method in different currencies are separate entries
- [Phase 03-mobile-pos-optimization]: closeConcert() still returns ConcertTotals; concert detail calls getConcertReport() separately after close to get full report
- [Phase 03-mobile-pos-optimization]: handleSyncNow uses local useState syncing flag (not syncStore) — spinner state is purely local UI concern
- [Phase 03-mobile-pos-optimization]: cardDisabled style appears after cardPrimary in StyleSheet array — ensures gray background overrides blue for disabled primary card
- [Phase 02-mobile-pos-core]: getLocalSales SELECT aliases all snake_case columns to camelCase at query level — removes need for runtime casts throughout the app
- [Phase 02-mobile-pos-core]: voidSale/unvoidSale accept optional items array — callers with pre-loaded parsedItems pass them directly, avoiding salesByGroup lookup that is empty in standalone screens
- [Phase 02-mobile-pos-core]: apiDeactivateProduct switched from PATCH to DELETE — server only exposes DELETE route for soft-delete deactivation
- [Phase 02-mobile-pos-core]: partialize in syncStore excludes isOnline from MMKV — cold start always defaults to false
- [Phase 02-mobile-pos-core]: consecutiveFailures threshold of 3 in NetInfo listener determines server reachability (no store subscription needed)

### New Features Added Post-Phase 2 (2026-03-18)

- **Deficit screen** (`app/deficit.tsx`): dedicated screen showing products with negative stock and quantity to reproduce; dashboard "Needs Restock" tile routes here with live badge count
- **Sale-to-concert linking**: sale detail screen allows assigning/reassigning a sale to any concert; synced to backend via `sale_update_concert` outbox type (offline-reliable)
- **Concert currency override**: concerts have a `currency` field; starting selling from a concert sets the cart default currency; review screen still allows per-sale override
- **History improvements**: `concertLabel()` helper for display names; "No Concert" group for unattached sales; filter dropdown stable across filter changes; payment_method snake_case fixed in list
- **Concert detail**: shows currency field; revenue breakdown by currency (no more hardcoded EUR symbol)
- **SyncManager**: immediate sync after sale recording (fire-and-forget); handles `sale_update_concert` outbox type; logs success/failure with HTTP status

### Pending Todos

None yet.

### Blockers/Concerns

**Resolved (2026-03-18):**
- Sync reliability issues from Phase 2 (payload format, missing wiring, pending count bugs) — all fixed
- Stock reconciliation between app and backend — resolved with delta-based merge (apiStock - pendingOutboxQuantities)
- SQLite concurrent access crash on Android — resolved with promise-based singleton + health check

**Remaining for Phase 3:**
- Battery efficiency during 4-6 hour events (POS-06) — not yet addressed
- Low-stock warnings below 5 units (POS-07) — not yet addressed
- Sales reports with totals filtered by concert (POS-08) — partial (concert detail shows totals; no dedicated report)
- End-of-event inventory reconciliation (POS-11) — not yet addressed
- Poor cellular sync reliability (POS-12) — basic backoff implemented; retry on foreground added

**Timeline:**
- Concert sales tool must be operational by early April (Phase 3 critical path)
- 8-12 hours per week development time available

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260418-001 | Hide SKU from app UI except product edit forms | 2026-04-18 | 200102a | [260418-001-hide-sku-display](./quick/260418-001-hide-sku-display/) |
| 260419-15b | Move Start Selling button to top of concert detail | 2026-04-19 | 4a3dc9c | [260419-15b-move-start-selling-button-to-top-of-conc](./quick/260419-15b-move-start-selling-button-to-top-of-conc/) |
| 260419-1hc | Remove duplicate History and Stock cards from dashboard | 2026-04-19 | 02e4a8e | [260419-1hc-remove-duplicate-history-and-stock-cards](./quick/260419-1hc-remove-duplicate-history-and-stock-cards/) |
| 260419-1uj | Add Active/Closed tabs to concert management list | 2026-04-19 | ad52a02 | [260419-1uj-add-active-closed-tabs-to-concert-manage](./quick/260419-1uj-add-active-closed-tabs-to-concert-manage/) |

## Session Continuity

Last session: 2026-03-19T20:46:33.491Z
Stopped at: Completed 02-mobile-pos-core-02-09-PLAN.md
Resume file: None
Next action: Discuss Phase 3 with `/gsd:discuss-phase`

---
*Created: 2026-02-13*
*Last updated: 2026-03-12T19:55:19Z after completing Plan 01-01*
