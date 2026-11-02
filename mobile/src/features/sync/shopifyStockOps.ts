/**
 * Shopify stock-op executor (07.1 D-09..D-15, D-17).
 *
 * One shopify_stock outbox row = one sale line (or one restock). Each row
 * becomes one inventoryAdjustQuantities delta at the pinned location. No
 * Shopify order is ever created.
 *
 * FROZEN-PLAN RULE: the plan (inventoryItemId, changeFrom, delta, key) is
 * persisted into the outbox payload BEFORE the first mutation attempt and is
 * never recomputed on retry - same key + different variables =
 * IDEMPOTENCY_KEY_PARAMETER_MISMATCH. Only a CHANGE_FROM_QUANTITY_STALE result
 * (the mutation provably did not apply) clears the plan and rotates the key.
 *
 * Residual race accepted (RESEARCH A8, T-07.1-28): Shopify idempotency keys
 * expire after 24h; a lost response replayed after >24h offline could double
 * apply. Single user syncing within hours - accepted.
 *
 * This file must NEVER touch useSyncStore: Shopify failures never flip the API
 * online indicator (D-14).
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { readVariantLevel, adjustAvailable } from '@/api/shopify';
import {
  SALE_APPLIED,
  getAllPendingOutboxRows,
  incrementAttempt,
  insertOutboxEntries,
  markOutboxDone,
  getOutboxRow,
  updatePendingOutboxPayload,
  type OutboxRow,
  type ShopifyStockPayload,
  type StockOpPlan,
} from '@/db/outbox';
import { getLocalSaleItems, setSaleLineApplied } from '@/db/sales';
import { runInTransaction, withDbLock } from '@/db/lock';

export const MAX_STALE_REPLANS = 3;
const MAX_BACKOFF_MS = 30000;

export type StockOpResult = 'done' | 'dropped' | 'retry' | 'deferred';

function referenceUri(kind: ShopifyStockPayload['kind'], payload: ShopifyStockPayload, rowId: string): string {
  switch (kind) {
    case 'deduct':
      return `gid://band-pos/Sale/${payload.saleId}`;
    case 'restore':
      return `gid://band-pos/SaleVoid/${payload.saleId}`;
    case 'unvoid':
      return `gid://band-pos/SaleUnvoid/${payload.saleId}`;
    default:
      return `gid://band-pos/Restock/${rowId}`;
  }
}

async function backoff(db: SQLiteDatabase, row: OutboxRow): Promise<void> {
  const delay = Math.min(1000 * Math.pow(2, row.attempt_count), MAX_BACKOFF_MS);
  await withDbLock(() => incrementAttempt(db, row.id, Date.now() + delay));
}

/** Total order on outbox rows: created_at, then id. */
function isBefore(a: OutboxRow, b: OutboxRow): boolean {
  return a.created_at < b.created_at || (a.created_at === b.created_at && a.id < b.id);
}

async function recordApplied(
  db: SQLiteDatabase,
  row: OutboxRow,
  payload: ShopifyStockPayload,
  appliedDelta: number
): Promise<void> {
  if (payload.kind === 'restock' || payload.saleId === undefined || payload.lineIndex === undefined) {
    return;
  }
  // Accumulate instead of overwriting (deduct/unvoid add a negative delta,
  // restore a positive one) so the line's net delta does not depend on the
  // order in which ops finish (CR-05).
  const items = await getLocalSaleItems(db, payload.saleId);
  const current = items?.[payload.lineIndex]?.appliedDelta;
  const value = (current ?? 0) + appliedDelta;
  await setSaleLineApplied(db, payload.saleId, payload.lineIndex, value);
  await insertOutboxEntries(db, [
    {
      id: Crypto.randomUUID(),
      type: SALE_APPLIED,
      payload: JSON.stringify({
        saleId: payload.saleId,
        lines: [{ lineIndex: payload.lineIndex, appliedDelta: value }],
      }),
      idempotency_key: `sale_applied:${row.id}`,
      created_at: Date.now(),
    },
  ]);
}

async function dropOp(
  db: SQLiteDatabase,
  row: OutboxRow,
  payload: ShopifyStockPayload,
  reason: string
): Promise<StockOpResult> {
  console.warn('[shopifyStockOps] dropped', {
    rowId: row.id,
    kind: payload.kind,
    variantGid: payload.variantGid,
    reason,
  });
  await commit(db, row, payload, 0);
  return 'dropped';
}

/**
 * One locked transaction: the applied delta, its sale_applied op and the done
 * flag land together and cannot be rolled back by another flow (CR-04).
 * An unplanned row (nothing was sent to Shopify) is only committed while it is
 * still pending: a void/unvoid may have cancelled it meanwhile (CR-01).
 */
async function commit(
  db: SQLiteDatabase,
  row: OutboxRow,
  payload: ShopifyStockPayload,
  appliedDelta: number
): Promise<boolean> {
  return runInTransaction(db, async () => {
    if (!payload.plan) {
      const current = await getOutboxRow(db, row.id);
      if (!current || current.status !== 'pending') return false;
    }
    await recordApplied(db, row, payload, appliedDelta);
    await markOutboxDone(db, row.id);
    return true;
  });
}

async function finish(
  db: SQLiteDatabase,
  row: OutboxRow,
  payload: ShopifyStockPayload,
  appliedDelta: number
): Promise<StockOpResult> {
  return (await commit(db, row, payload, appliedDelta)) ? 'done' : 'dropped';
}

async function run(db: SQLiteDatabase, snapshot: OutboxRow): Promise<StockOpResult> {
  // The caller's row may be a stale snapshot (the sync run awaited API calls
  // first): a void/unvoid may have cancelled it since (CR-01).
  const fresh = await getOutboxRow(db, snapshot.id);
  if (!fresh || fresh.status !== 'pending') return 'dropped';
  const row = fresh;

  let payload: ShopifyStockPayload;
  try {
    payload = JSON.parse(row.payload) as ShopifyStockPayload;
    if (!payload || typeof payload.variantGid !== 'string' || !payload.kind) throw new Error('bad payload');
  } catch {
    console.warn('[shopifyStockOps] unparsable payload, dropping', { rowId: row.id });
    await withDbLock(() => markOutboxDone(db, row.id));
    return 'dropped';
  }

  let plan: StockOpPlan | undefined = payload.plan;
  let stale = 0;

  for (;;) {
    if (!plan) {
      // Step 2: determine the signed amount.
      let requested: number; // positive magnitude
      let negative: boolean;
      if (payload.kind === 'restore') {
        const items =
          payload.saleId !== undefined ? await getLocalSaleItems(db, payload.saleId) : null;
        const line = items && payload.lineIndex !== undefined ? items[payload.lineIndex] : undefined;
        if (line) {
          // The restore amount is read from appliedDelta, so every op queued
          // before this restore on the same line must have landed first,
          // whatever appliedDelta currently says (CR-05). Ordering is
          // (created_at, id) so two restores never wait on each other.
          const pending = await getAllPendingOutboxRows(db);
          const waiting = pending.some((r) => {
            if (r.id === row.id || r.type !== 'shopify_stock') return false;
            if (!isBefore(r, row)) return false;
            try {
              const p = JSON.parse(r.payload) as ShopifyStockPayload;
              return p.saleId === payload.saleId && p.lineIndex === payload.lineIndex;
            } catch {
              return false;
            }
          });
          if (waiting) {
            await backoff(db, row);
            return 'deferred';
          }
        }
        requested = Math.max(0, -(line?.appliedDelta ?? 0));
        negative = false;
        if (requested === 0) return finish(db, row, payload, 0);
      } else if (payload.kind === 'restock') {
        negative = payload.requested < 0;
        requested = Math.abs(payload.requested);
        if (requested === 0) return finish(db, row, payload, 0);
      } else {
        negative = true;
        requested = payload.requested;
        if (requested <= 0) return finish(db, row, payload, 0);
      }

      const level = await readVariantLevel(payload.variantGid);
      if (!level) return dropOp(db, row, payload, 'variant not found');

      let delta: number;
      let changeFrom: number | null;
      if (negative) {
        delta = -Math.min(requested, Math.max(level.available, 0));
        changeFrom = level.available;
      } else {
        delta = requested;
        changeFrom = null;
      }
      if (delta === 0) return finish(db, row, payload, 0);

      plan = {
        inventoryItemId: level.inventoryItemId,
        changeFrom,
        delta,
        // nextKey is persisted on every replan, so a later sync run never
        // reuses a key already burned with different variables (CR-02).
        key: payload.nextKey ?? row.id,
      };
      payload = { ...payload, plan };
      // Persisting the plan is the commit point: conditional on the row still
      // being pending, under the same lock enqueueReversal takes. Once planned
      // a row can no longer be cancelled (enqueueReversal skips planned rows).
      const planned = JSON.stringify(payload);
      const committed = await withDbLock(() => updatePendingOutboxPayload(db, row.id, planned));
      if (!committed) return 'dropped'; // cancelled while we were reading the level
    }

    const res = await adjustAvailable({
      inventoryItemId: plan.inventoryItemId,
      delta: plan.delta,
      changeFromQuantity: plan.changeFrom,
      referenceDocumentUri: referenceUri(payload.kind, payload, row.id),
      idempotencyKey: plan.key,
    });

    if (res.ok) return finish(db, row, payload, res.appliedDelta);

    switch (res.code) {
      case 'CHANGE_FROM_QUANTITY_STALE': {
        stale += 1;
        plan = undefined;
        const { plan: _dropped, ...rest } = payload;
        payload = { ...rest, nextKey: Crypto.randomUUID() } as ShopifyStockPayload;
        await withDbLock(() => updatePendingOutboxPayload(db, row.id, JSON.stringify(payload)));
        if (stale >= MAX_STALE_REPLANS) {
          await backoff(db, row);
          return 'retry';
        }
        continue;
      }
      case 'INVALID_INVENTORY_ITEM':
      case 'ITEM_NOT_STOCKED_AT_LOCATION':
        return dropOp(db, row, payload, res.code);
      case 'IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED': {
        const newPlan: StockOpPlan = { ...plan, key: Crypto.randomUUID() };
        payload = { ...payload, plan: newPlan };
        await withDbLock(() => updatePendingOutboxPayload(db, row.id, JSON.stringify(payload)));
        await backoff(db, row);
        return 'retry';
      }
      case 'IDEMPOTENCY_KEY_PARAMETER_MISMATCH':
        console.error('[shopifyStockOps] idempotency parameter mismatch (bug)', { rowId: row.id });
        await backoff(db, row);
        return 'retry';
      default:
        await backoff(db, row);
        return 'retry';
    }
  }
}

/**
 * Executes one shopify_stock outbox row. Never throws.
 */
export async function executeStockOp(db: SQLiteDatabase, row: OutboxRow): Promise<StockOpResult> {
  try {
    return await run(db, row);
  } catch (err) {
    // ShopifyError (retryable or config) and anything unexpected: keep plan + key, back off.
    console.warn('[shopifyStockOps] retry', {
      rowId: row.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
    try {
      await backoff(db, row);
    } catch {
      /* never throw to caller */
    }
    return 'retry';
  }
}
