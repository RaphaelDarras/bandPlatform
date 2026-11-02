/**
 * SyncManager — background outbox processor.
 *
 * Processes pending outbox rows in batches of 10.
 * Supports sale_create (batched), sale_set_voided (plus legacy sale_void /
 * sale_unvoid), sale_update_concert and
 * sale_applied (API ops) plus shopify_stock (direct-to-Shopify stock ops, 07.1 D-14).
 * Shopify failures never flip API connectivity (syncStore) and never block API ops.
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
  SHOPIFY_STOCK,
  SALE_APPLIED,
  getPendingOutboxRows,
  markOutboxDone,
  markOutboxDoneIfPayload,
  markOutboxFailed,
  SALE_SET_VOIDED,
  incrementAttempt,
  type OutboxRow,
} from '@/db/outbox';
import { withDbLock } from '@/db/lock';
import { apiUpdateSale, apiPatchSaleApplied } from '@/api/sales';
import { executeStockOp } from '@/features/sync/shopifyStockOps';
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
    const stockRows = pendingRows.filter((r) => r.type === SHOPIFY_STOCK);
    const otherRows = pendingRows.filter(
      (r) => r.type !== 'sale_create' && r.type !== SHOPIFY_STOCK
    );

    // The API loop and the Shopify loop run concurrently (WR-08): a Render
    // cold start or an offline API no longer delays Shopify stock writes by
    // the axios timeouts. DB writes from both are serialised by db/lock, and
    // executeStockOp re-reads each row before acting on it (CR-01).
    const apiPart = async () => {
      // Process sale_create in a single batch (up to BATCH_SIZE)
      if (saleCreateRows.length > 0) {
        await processSaleCreateBatch(db, apiClient, saleCreateRows.slice(0, BATCH_SIZE));
      }

      // Process void/unvoid/concert/applied rows individually
      for (const row of otherRows) {
        await processOtherRow(db, apiClient, row);
      }
    };

    // Shopify stock ops: sequential, isolated, no syncStore signals (D-14)
    const stockPart = async () => {
      for (const row of stockRows) {
        try {
          await executeStockOp(db, row);
        } catch {
          console.warn('[SyncManager] stock op error', row.id);
        }
      }
    };

    const [apiResult] = await Promise.allSettled([apiPart(), stockPart()]);
    if (apiResult.status === 'rejected') {
      console.warn('[SyncManager] API ops error', apiResult.reason);
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
    // Settle each row from the server's per-sale results (WR-01): an invalid
    // sale is marked failed instead of blocking every later batch. A server
    // without `results` (pre-WR-01) only answers 201 when all were stored.
    const results = (response.data as { results?: { idempotencyKey?: string; status?: string }[] })
      ?.results;
    const statusByKey = new Map<string, string>();
    if (Array.isArray(results)) {
      for (const r of results) {
        if (r && typeof r.idempotencyKey === 'string' && typeof r.status === 'string') {
          statusByKey.set(r.idempotencyKey, r.status);
        }
      }
    }
    for (const row of rows) {
      const status = Array.isArray(results) ? statusByKey.get(row.idempotency_key) : 'created';
      if (status === 'created' || status === 'skipped') {
        await withDbLock(() => markOutboxDone(db, row.id));
      } else if (status === 'invalid') {
        console.warn('[SyncManager] sale rejected by server, marking failed', { id: row.id });
        await withDbLock(() => markOutboxFailed(db, row.id));
      }
      // no result for this row: leave it pending for the next run
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
      await withDbLock(() => incrementAttempt(db, row.id, Date.now() + delay));
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

/**
 * 4xx responses that retrying cannot fix. 404 is excluded (the sale may not be
 * synced yet), as are auth (401/403), timeout (408) and rate limiting (429).
 */
function isPermanentClientError(status: number | undefined): boolean {
  if (status === undefined || status < 400 || status >= 500) return false;
  return ![401, 403, 404, 408, 429].includes(status);
}

async function processOtherRow(
  db: SQLiteDatabase,
  apiClient: AxiosInstance,
  row: OutboxRow
): Promise<void> {
  try {
    const payload = JSON.parse(row.payload);

    if (row.type === SALE_SET_VOIDED) {
      await apiClient.post(`sales/${payload.saleId}/${payload.voided ? 'void' : 'unvoid'}`, {});
    } else if (row.type === 'sale_void') {
      await apiClient.post(`sales/${payload.saleId}/void`, {});
    } else if (row.type === 'sale_unvoid') {
      await apiClient.post(`sales/${payload.saleId}/unvoid`, {});
    } else if (row.type === 'sale_update_concert') {
      await apiUpdateSale(payload.saleId, { concertId: payload.concertId });
    } else if (row.type === SALE_APPLIED) {
      await apiPatchSaleApplied(payload.saleId, payload.lines);
    } else {
      // Unknown type — skip and mark done to avoid blocking queue
      await withDbLock(() => markOutboxDone(db, row.id));
      return;
    }

    // Conditional on the payload that was sent: a sale_applied row re-upserted
    // with a newer value meanwhile stays pending (CR-03).
    await withDbLock(() => markOutboxDoneIfPayload(db, row.id, row.payload));
    useSyncStore.getState().resetFailures();
    useSyncStore.getState().setIsOnline(true);
    useSyncStore.getState().setLastSyncAt(Date.now());
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    const status = axiosErr.response?.status;
    if (isPermanentClientError(status)) {
      // Retrying a request the server rejects as invalid can never succeed and
      // would keep pendingCount above 0 forever (CR-06).
      console.warn('[SyncManager] API op rejected, marking failed', { id: row.id, type: row.type, status });
      await withDbLock(() => markOutboxFailed(db, row.id));
      useSyncStore.getState().setIsOnline(true);
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, row.attempt_count), MAX_BACKOFF_MS);
    await withDbLock(() => incrementAttempt(db, row.id, Date.now() + delay));
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
