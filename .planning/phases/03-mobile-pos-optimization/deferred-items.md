# Deferred Items — Phase 03

## Pre-existing Test Failures (out of scope for 03-01)

Discovered during 03-01 execution. These failures exist in the git working tree before plan 03-01 changes.

### syncManager.test.ts (8 failures)

The working tree version of `mobile/src/features/sync/SyncManager.ts` differs from the committed version (c536304) with these changes:
- Added `apiUpdateSale` import for `sale_update_concert` handling
- Changed pending count from estimated to re-query approach (`getPendingOutboxRows` after sync)
- Added payment method normalization map
- Added `sale_update_concert` outbox type handling

These changes (from post-Phase 2 work) cause the syncManager unit tests to fail because mocks and assertions don't account for the new `getPendingOutboxRows` call at the end of `requestSync`.

**Resolution needed:** Update syncManager.test.ts to mock the second `getPendingOutboxRows` call and update assertions for the new batch payload format.

### stock.test.ts, history.test.ts, saleRecording.test.ts

Also pre-existing failures from working tree changes, not caused by 03-01 plan execution.
