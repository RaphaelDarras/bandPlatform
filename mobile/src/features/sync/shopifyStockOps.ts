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
  updateOutboxPayload,
  type OutboxRow,
  type ShopifyStockPayload,
  type StockOpPlan,
} from '@/db/outbox';
import { getLocalSaleItems, setSaleLineApplied } from '@/db/sales';

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
  await incrementAttempt(db, row.id, Date.now() + delay);
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
  const value = payload.kind === 'restore' ? 0 : appliedDelta;
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
  await recordApplied(db, row, payload, 0);
  await markOutboxDone(db, row.id);
  return 'dropped';
}

async function finish(
  db: SQLiteDatabase,
  row: OutboxRow,
  payload: ShopifyStockPayload,
  appliedDelta: number
): Promise<StockOpResult> {
  await recordApplied(db, row, payload, appliedDelta);
  await markOutboxDone(db, row.id);
  return 'done';
}

async function run(db: SQLiteDatabase, row: OutboxRow): Promise<StockOpResult> {
  let payload: ShopifyStockPayload;
  try {
    payload = JSON.parse(row.payload) as ShopifyStockPayload;
    if (!payload || typeof payload.variantGid !== 'string' || !payload.kind) throw new Error('bad payload');
  } catch {
    console.warn('[shopifyStockOps] unparsable payload, dropping', { rowId: row.id });
    await markOutboxDone(db, row.id);
    return 'dropped';
  }

  let plan: StockOpPlan | undefined = payload.plan;
  let keyOverride: string | undefined;
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
        if (line && line.appliedDelta === undefined) {
          const pending = await getAllPendingOutboxRows(db);
          const waiting = pending.some((r) => {
            if (r.id === row.id || r.type !== 'shopify_stock') return false;
            try {
              const p = JSON.parse(r.payload) as ShopifyStockPayload;
              return (
                (p.kind === 'deduct' || p.kind === 'unvoid') &&
                p.saleId === payload.saleId &&
                p.lineIndex === payload.lineIndex
              );
            } catch {
              return false;
            }
          });
          if (waiting) {
            await backoff(db, row);
            return 'deferred';
          }
        }
        requested = -(line?.appliedDelta ?? 0);
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
        key: keyOverride ?? row.id,
      };
      payload = { ...payload, plan };
      await updateOutboxPayload(db, row.id, JSON.stringify(payload));
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
        keyOverride = Crypto.randomUUID();
        plan = undefined;
        const { plan: _dropped, ...rest } = payload;
        payload = rest as ShopifyStockPayload;
        await updateOutboxPayload(db, row.id, JSON.stringify(payload));
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
        await updateOutboxPayload(db, row.id, JSON.stringify(payload));
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
