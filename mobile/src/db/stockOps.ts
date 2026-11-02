/**
 * Shopify stock outbox op builders (phase 07.1).
 *
 * - One shopify_stock row per sale line, so a deleted variant only drops its own
 *   line (D-15) and the Mongo sale write stays independent of the Shopify write (D-14).
 * - The restore amount is decided at execution time from the line's appliedDelta
 *   (D-13): never the sold quantity. `requested` on a restore row is a display
 *   estimate only.
 * - The outbox row id of every entry doubles as the default Shopify idempotency key.
 */
import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import {
  SHOPIFY_STOCK,
  getAllPendingOutboxRows,
  insertOutboxEntries,
  markOutboxDone,
} from '@/db/outbox';
import { runInTransaction } from '@/db/lock';
import type {
  LocalSaleItem,
  OutboxEntryInput,
  OutboxRow,
  ShopifyStockPayload,
  StockOpKind,
} from '@/db/outbox';

type IdFn = () => string;

const defaultNewId: IdFn = () => Crypto.randomUUID();

export function buildDeductEntries(
  saleId: string,
  items: LocalSaleItem[],
  now: number,
  newId: IdFn = defaultNewId
): OutboxEntryInput[] {
  const entries: OutboxEntryInput[] = [];
  items.forEach((item, lineIndex) => {
    if (!item.variantGid) return;
    const payload: ShopifyStockPayload = {
      kind: 'deduct',
      variantGid: item.variantGid,
      saleId,
      lineIndex,
      requested: item.quantity,
    };
    entries.push({
      id: newId(),
      type: SHOPIFY_STOCK,
      payload: JSON.stringify(payload),
      idempotency_key: `shopify_stock:${saleId}:${lineIndex}:deduct`,
      created_at: now + 1 + lineIndex,
    });
  });
  return entries;
}

export function buildRestockEntry(
  variantGid: string,
  delta: number,
  note: string,
  now: number,
  newId: IdFn = defaultNewId
): OutboxEntryInput {
  const id = newId();
  const payload: ShopifyStockPayload = {
    kind: 'restock',
    variantGid,
    requested: delta,
    note,
  };
  return {
    id,
    type: SHOPIFY_STOCK,
    payload: JSON.stringify(payload),
    idempotency_key: `shopify_stock:restock:${id}`,
    created_at: now,
  };
}

function parseStockRow(
  row: OutboxRow
): { row: OutboxRow; payload: ShopifyStockPayload } | null {
  if (row.type !== SHOPIFY_STOCK) return null;
  try {
    const payload = JSON.parse(row.payload) as ShopifyStockPayload;
    if (!payload || typeof payload !== 'object') return null;
    return { row, payload };
  } catch {
    return null;
  }
}

/**
 * Shared void/unvoid logic: for each line with a variantGid, cancel a pending,
 * not-yet-planned opposite op if one exists (net zero); otherwise enqueue a new op.
 * No transaction of its own: the caller must hold one (runInTransaction).
 */
async function queueReversal(
  db: SQLite.SQLiteDatabase,
  saleId: string,
  items: LocalSaleItem[],
  now: number,
  newId: IdFn,
  cancelKinds: StockOpKind[],
  newKind: 'restore' | 'unvoid'
): Promise<{ cancelled: number; enqueued: number }> {
  const pending = (await getAllPendingOutboxRows(db))
    .map(parseStockRow)
    .filter((p): p is { row: OutboxRow; payload: ShopifyStockPayload } => p !== null);

  let cancelled = 0;
  const toInsert: OutboxEntryInput[] = [];

  for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
    const item = items[lineIndex];
    if (!item.variantGid) continue;

    const cancellable = pending.find(
      (p) =>
        p.payload.saleId === saleId &&
        p.payload.lineIndex === lineIndex &&
        cancelKinds.includes(p.payload.kind) &&
        !p.payload.plan
    );
    if (cancellable) {
      await markOutboxDone(db, cancellable.row.id);
      // Drop from the working set so a second pass cannot cancel it twice.
      pending.splice(pending.indexOf(cancellable), 1);
      cancelled++;
      continue;
    }

    const id = newId();
    const requested =
      newKind === 'restore' && item.appliedDelta !== undefined
        ? -item.appliedDelta
        : item.quantity;
    const payload: ShopifyStockPayload = {
      kind: newKind,
      variantGid: item.variantGid,
      saleId,
      lineIndex,
      requested,
    };
    toInsert.push({
      id,
      type: SHOPIFY_STOCK,
      payload: JSON.stringify(payload),
      idempotency_key: `shopify_stock:${saleId}:${lineIndex}:${newKind}:${id}`,
      created_at: now + lineIndex,
    });
  }

  if (toInsert.length > 0) await insertOutboxEntries(db, toInsert);
  return { cancelled, enqueued: toInsert.length };
}

/**
 * For callers that already hold a transaction, so the sale flag, the stock ops
 * and the API flag op commit together (WR-07).
 */
export function queueVoidRestores(
  db: SQLite.SQLiteDatabase,
  saleId: string,
  items: LocalSaleItem[],
  now: number,
  newId: IdFn = defaultNewId
): Promise<{ cancelled: number; enqueued: number }> {
  return queueReversal(db, saleId, items, now, newId, ['deduct', 'unvoid'], 'restore');
}

export function queueUnvoidDeducts(
  db: SQLite.SQLiteDatabase,
  saleId: string,
  items: LocalSaleItem[],
  now: number,
  newId: IdFn = defaultNewId
): Promise<{ cancelled: number; enqueued: number }> {
  return queueReversal(db, saleId, items, now, newId, ['restore'], 'unvoid');
}

export function enqueueVoidRestores(
  db: SQLite.SQLiteDatabase,
  saleId: string,
  items: LocalSaleItem[],
  now: number,
  newId: IdFn = defaultNewId
): Promise<{ cancelled: number; enqueued: number }> {
  return runInTransaction(db, () => queueVoidRestores(db, saleId, items, now, newId));
}

export function enqueueUnvoidDeducts(
  db: SQLite.SQLiteDatabase,
  saleId: string,
  items: LocalSaleItem[],
  now: number,
  newId: IdFn = defaultNewId
): Promise<{ cancelled: number; enqueued: number }> {
  return runInTransaction(db, () => queueUnvoidDeducts(db, saleId, items, now, newId));
}
