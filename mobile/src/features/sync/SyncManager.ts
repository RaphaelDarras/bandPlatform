/**
 * SyncManager — background outbox processor.
 *
 * Processes pending outbox rows in batches of 10.
 * Supports sale_create (batched), sale_void, and sale_unvoid types.
 * Exponential backoff on failure (capped at 30s).
 * After 3 consecutive failures, sets syncStore alert flag.
 *
 * POS-06 (battery efficiency): 60s periodic sync interval with exponential backoff
 * is sufficient for 4-6 hour concert events on modern phones. No battery-specific
 * optimizations needed per user decision (2026-03-18).
 *
 * POS-11 (end-of-event reconciliation): Satisfied by existing restock screen
 * (mobile/src/app/restock.tsx) which supports positive and negative stock
 * adjustments with reason field. No dedicated reconciliation screen needed.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AxiosInstance } from 'axios';

import {
  getPendingOutboxRows,
  markOutboxDone,
  incrementAttempt,
  type OutboxRow,
} from '@/db/outbox';
import { apiUpdateSale } from '@/api/sales';
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
      // Outbox empty — ping server to verify reachability before claiming online.
      // Retry once with longer timeout to handle Render free-tier cold starts.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await apiClient.get('concerts', { timeout: attempt === 0 ? 15000 : 60000 });
          useSyncStore.getState().resetFailures();
          useSyncStore.getState().setIsOnline(true);
          useSyncStore.getState().setPendingCount(0);
          useSyncStore.getState().setLastSyncAt(Date.now());
          break;
        } catch {
          if (attempt === 1) {
            useSyncStore.getState().incrementFailures();
            useSyncStore.getState().setIsOnline(false);
          }
        }
      }
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

    // Re-query actual pending count — don't estimate, since batch/individual
    // processing can silently fail and leave rows still pending.
    const remaining = await getPendingOutboxRows(db);
    useSyncStore.getState().setPendingCount(remaining.length);
  } finally {
    syncInProgress = false;
  }
}

async function processSaleCreateBatch(
  db: SQLiteDatabase,
  apiClient: AxiosInstance,
  rows: OutboxRow[]
): Promise<void> {
  const PAYMENT_METHOD_MAP: Record<string, string> = {
    'Cash': 'cash', 'Card': 'card', 'E-transfer': 'etransfer', 'PayPal': 'paypal',
  };

  const sales = rows.map((row) => {
    const payload = JSON.parse(row.payload);
    // Resolve paymentMethod: handle split format "Card:10/Cash:15" from old outbox entries
    let resolvedPM = payload.paymentMethod ?? 'cash';
    if (resolvedPM.includes('/') && resolvedPM.includes(':')) {
      // Split payment — extract individual methods for paymentSplit, set method to 'split'
      if (!payload.paymentSplit) {
        payload.paymentSplit = resolvedPM.split('/').map((part: string) => {
          const colonIdx = part.indexOf(':');
          const label = part.substring(0, colonIdx).trim();
          const amount = parseFloat(part.substring(colonIdx + 1)) || 0;
          return { method: PAYMENT_METHOD_MAP[label] ?? label.toLowerCase(), amount };
        });
      }
      resolvedPM = 'split';
    } else {
      resolvedPM = PAYMENT_METHOD_MAP[resolvedPM] ?? resolvedPM.toLowerCase();
    }

    const sale: Record<string, unknown> = {
      ...payload,
      idempotencyKey: row.idempotency_key,
      paymentMethod: resolvedPM,
    };
    // Drop empty concertId — backend expects a valid ObjectId or nothing
    if (!sale.concertId) {
      delete sale.concertId;
    }
    return sale;
  });

  console.log('[SyncManager] Sending batch:', JSON.stringify(sales, null, 2));
  try {
    const response = await apiClient.post('sales/batch', sales);
    console.log('[SyncManager] Batch sync success:', JSON.stringify(response.data));
    // Mark all rows done and reset failure counter
    for (const row of rows) {
      await markOutboxDone(db, row.id);
    }
    useSyncStore.getState().resetFailures();
    useSyncStore.getState().setIsOnline(true);
    useSyncStore.getState().setLastSyncAt(Date.now());
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error(
      '[SyncManager] Batch sync FAILED:',
      axiosErr.response?.status,
      JSON.stringify(axiosErr.response?.data ?? axiosErr.message),
    );
    // Increment attempt for all rows in batch
    for (const row of rows) {
      const delay = Math.min(1000 * Math.pow(2, row.attempt_count), MAX_BACKOFF_MS);
      await incrementAttempt(db, row.id, Date.now() + delay);
    }

    // Distinguish network errors from server errors:
    // - Server responded (4xx/5xx): server is reachable, data is bad → stay online
    // - No response (timeout, network down): server unreachable → increment failures
    if (axiosErr.response) {
      // Server responded — it's online, the payload is just invalid
      useSyncStore.getState().setIsOnline(true);
    } else {
      useSyncStore.getState().incrementFailures();
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
    } else if (row.type === 'sale_update_concert') {
      await apiUpdateSale(payload.saleId, { concertId: payload.concertId });
    } else {
      // Unknown type — skip and mark done to avoid blocking queue
      await markOutboxDone(db, row.id);
      return;
    }

    await markOutboxDone(db, row.id);
    useSyncStore.getState().resetFailures();
    useSyncStore.getState().setIsOnline(true);
    useSyncStore.getState().setLastSyncAt(Date.now());
  } catch (err: unknown) {
    const delay = Math.min(1000 * Math.pow(2, row.attempt_count), MAX_BACKOFF_MS);
    await incrementAttempt(db, row.id, Date.now() + delay);
    const axiosErr = err as { response?: unknown };
    if (axiosErr.response) {
      useSyncStore.getState().setIsOnline(true);
    } else {
      useSyncStore.getState().incrementFailures();
    }
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
