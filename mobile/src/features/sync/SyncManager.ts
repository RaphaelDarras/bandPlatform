/**
 * SyncManager — background outbox processor.
 *
 * Processes pending outbox rows in batches of 10.
 * Supports sale_create (batched), sale_void, and sale_unvoid types.
 * Exponential backoff on failure (capped at 30s).
 * After 3 consecutive failures, sets syncStore alert flag.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AxiosInstance } from 'axios';

import {
  getPendingOutboxRows,
  markOutboxDone,
  incrementAttempt,
  type OutboxRow,
} from '@/db/outbox';
import { useSyncStore } from '@/stores/syncStore';

const BATCH_SIZE = 10;
const MAX_BACKOFF_MS = 30000;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

// Singleton guard to prevent concurrent sync runs
let syncInProgress = false;
let periodicSyncInterval: ReturnType<typeof setInterval> | null = null;

/** Resets internal state — for use in tests only. */
export function _resetSyncState(): void {
  syncInProgress = false;
}

/**
 * Processes pending outbox rows. Batches sale_create entries together.
 * Called manually or by connectivity/periodic hooks.
 */
export async function requestSync(
  db: SQLiteDatabase,
  apiClient: AxiosInstance
): Promise<void> {
  if (syncInProgress) {
    return;
  }
  syncInProgress = true;

  try {
    const pendingRows = await getPendingOutboxRows(db);
    if (pendingRows.length === 0) {
      useSyncStore.getState().setPendingCount(0);
      return;
    }

    // Separate sale_create rows for batching from other types
    const saleCreateRows = pendingRows.filter((r) => r.type === 'sale_create');
    const otherRows = pendingRows.filter((r) => r.type !== 'sale_create');

    // Process sale_create in a single batch (up to BATCH_SIZE)
    if (saleCreateRows.length > 0) {
      await processSaleCreateBatch(db, apiClient, saleCreateRows.slice(0, BATCH_SIZE));
    }

    // Process void/unvoid rows individually
    for (const row of otherRows) {
      await processOtherRow(db, apiClient, row);
    }

    // Update pending count after processing: remaining = original - processed
    const processed = saleCreateRows.slice(0, BATCH_SIZE).length + otherRows.length;
    const estimatedRemaining = Math.max(0, pendingRows.length - processed);
    useSyncStore.getState().setPendingCount(estimatedRemaining);
  } finally {
    syncInProgress = false;
  }
}

async function processSaleCreateBatch(
  db: SQLiteDatabase,
  apiClient: AxiosInstance,
  rows: OutboxRow[]
): Promise<void> {
  const sales = rows.map((row) => {
    const payload = JSON.parse(row.payload);
    return {
      ...payload,
      idempotencyKey: row.idempotency_key,
    };
  });

  try {
    await apiClient.post('sales/batch', { sales });
    // Mark all rows done and reset failure counter
    for (const row of rows) {
      await markOutboxDone(db, row.id);
    }
    useSyncStore.getState().resetFailures();
    useSyncStore.getState().setLastSyncAt(Date.now());
  } catch {
    // Increment attempt for all rows in batch
    for (const row of rows) {
      const delay = Math.min(1000 * Math.pow(2, row.attempt_count), MAX_BACKOFF_MS);
      await incrementAttempt(db, row.id, Date.now() + delay);
    }
    useSyncStore.getState().incrementFailures();

    const state = useSyncStore.getState();
    if (state.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      // Alert threshold reached — UI layer listens to consecutiveFailures in the store
      // No direct Alert call here — keeps SyncManager testable and UI-agnostic
    }
  }
}

async function processOtherRow(
  db: SQLiteDatabase,
  apiClient: AxiosInstance,
  row: OutboxRow
): Promise<void> {
  try {
    const payload = JSON.parse(row.payload);

    if (row.type === 'sale_void') {
      await apiClient.post(`sales/${payload.saleId}/void`, {});
    } else if (row.type === 'sale_unvoid') {
      await apiClient.post(`sales/${payload.saleId}/unvoid`, {});
    } else {
      // Unknown type — skip and mark done to avoid blocking queue
      await markOutboxDone(db, row.id);
      return;
    }

    await markOutboxDone(db, row.id);
    useSyncStore.getState().resetFailures();
    useSyncStore.getState().setLastSyncAt(Date.now());
  } catch {
    const delay = Math.min(1000 * Math.pow(2, row.attempt_count), MAX_BACKOFF_MS);
    await incrementAttempt(db, row.id, Date.now() + delay);
    useSyncStore.getState().incrementFailures();
  }
}

/**
 * Starts a periodic sync interval (60 seconds).
 */
export function startPeriodicSync(
  db: SQLiteDatabase,
  apiClient: AxiosInstance
): void {
  stopPeriodicSync(); // Clear any existing interval
  periodicSyncInterval = setInterval(() => {
    requestSync(db, apiClient);
  }, 60000);
}

/**
 * Clears the periodic sync interval.
 */
export function stopPeriodicSync(): void {
  if (periodicSyncInterval !== null) {
    clearInterval(periodicSyncInterval);
    periodicSyncInterval = null;
  }
}
