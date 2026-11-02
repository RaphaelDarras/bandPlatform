import * as SQLite from 'expo-sqlite';
import { runInTransaction } from './lock';

/**
 * The outbox holds two independent op families (D-14):
 *  - API (Mongo): sale_create / sale_set_voided / sale_update_concert / sale_applied
 *    (legacy sale_void / sale_unvoid rows are still processed)
 *  - Shopify:     shopify_stock (one row per sale line / restock)
 */
export const SHOPIFY_STOCK = 'shopify_stock';
export const SALE_APPLIED = 'sale_applied';
/** Desired voided state of a sale (replaces sale_void / sale_unvoid, CR-06). */
export const SALE_SET_VOIDED = 'sale_set_voided';

export interface OutboxRow {
  id: string;
  type: string;
  payload: string;
  idempotency_key: string;
  status: 'pending' | 'done' | 'failed';
  attempt_count: number;
  next_attempt_at: number;
  created_at: number;
}

export interface LocalSaleItem {
  productGid?: string; // gid://shopify/Product/<n> (always set on 07.1+ lines)
  variantGid?: string; // gid://shopify/ProductVariant/<n> (always set on 07.1+ lines)
  productName?: string; // snapshot at sale time
  variantLabel?: string; // snapshot at sale time ('' for single-variant products)
  variantSku: string; // snapshot SKU ('' when Shopify has none)
  quantity: number;
  priceAtSale: number; // unit price at sale time
  appliedDelta?: number; // net Shopify delta currently applied for this line (<= 0)
  productId?: string; // legacy Mongo id on pre-07.1 lines re-pulled from the API (D-21)
}

export interface PaymentSplitEntry {
  method: string;
  amount: number;
}

export interface LocalSale {
  id: string;
  concertId: string;
  items: LocalSaleItem[];
  totalAmount: number;
  paymentMethod: string;
  /**
   * Per-method breakdown for split payments. Only set when paymentMethod === 'split'.
   * Persisted as JSON in sales.payment_split_json.
   */
  paymentSplit?: PaymentSplitEntry[];
  currency: string;
  discount: number;
  discountType: 'flat' | 'percent';
}

export type OutboxEntryInput = Omit<OutboxRow, 'status' | 'attempt_count' | 'next_attempt_at'>;

export type StockOpKind = 'deduct' | 'restore' | 'unvoid' | 'restock';
export interface StockOpPlan {
  inventoryItemId: string;
  changeFrom: number | null; // available read before a negative delta; null for positive
  delta: number; // the frozen delta to send (non-zero)
  key: string; // Shopify @idempotent key (outbox row id, or a rotated UUID)
}
export interface ShopifyStockPayload {
  kind: StockOpKind;
  variantGid: string;
  saleId?: string; // set for deduct/restore/unvoid
  lineIndex?: number; // set for deduct/restore/unvoid
  requested: number; // deduct/unvoid: positive qty; restock: signed delta; restore: display estimate only
  note?: string; // restock reason text (local audit only)
  plan?: StockOpPlan; // written BEFORE the first mutation attempt
  nextKey?: string; // key for the next plan after a stale replan (never reuse a burned key)
  hardFailures?: number; // non-retryable failures so far (WR-03)
}

const INSERT_OUTBOX_SQL = `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`;

function outboxParams(e: OutboxEntryInput): (string | number)[] {
  return [e.id, e.type, e.payload, e.idempotency_key, e.created_at];
}

/**
 * Atomic write: sale + all outbox entries (sale_create + shopify_stock rows) in one transaction.
 * Called the instant the user taps "Confirm" - write is the first operation.
 */
export async function recordSaleLocally(
  db: SQLite.SQLiteDatabase,
  sale: LocalSale,
  outboxEntries: OutboxEntryInput[]
): Promise<void> {
  await runInTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO sales (id, concert_id, items_json, total_amount, payment_method,
        payment_split_json, currency, discount, discount_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sale.id,
        sale.concertId,
        JSON.stringify(sale.items),
        sale.totalAmount,
        sale.paymentMethod,
        sale.paymentSplit ? JSON.stringify(sale.paymentSplit) : null,
        sale.currency,
        sale.discount,
        sale.discountType,
        Date.now(),
      ]
    );
    // INSERT OR IGNORE prevents duplicate on retry
    for (const entry of outboxEntries) {
      await db.runAsync(INSERT_OUTBOX_SQL, outboxParams(entry));
    }
  });
}

/**
 * Inserts outbox entries (INSERT OR IGNORE). No transaction of its own;
 * callers needing atomicity wrap it in runInTransaction (db/lock).
 */
export async function insertOutboxEntries(
  db: SQLite.SQLiteDatabase,
  entries: OutboxEntryInput[]
): Promise<void> {
  for (const entry of entries) {
    await db.runAsync(INSERT_OUTBOX_SQL, outboxParams(entry));
  }
}

/**
 * Keeps at most ONE sale_applied row per sale line, carrying the line's
 * CURRENT local appliedDelta (CR-03). Re-upserting returns the row to pending
 * with a fresh backoff, so an older value can never be sent after a newer one.
 */
export async function upsertSaleApplied(
  db: SQLite.SQLiteDatabase,
  id: string,
  saleId: string,
  lineIndex: number,
  appliedDelta: number,
  now: number
): Promise<void> {
  await db.runAsync(
    `INSERT INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)
     ON CONFLICT(idempotency_key) DO UPDATE SET
       payload = excluded.payload, status = 'pending', attempt_count = 0,
       next_attempt_at = 0, created_at = excluded.created_at`,
    [
      id,
      SALE_APPLIED,
      JSON.stringify({ saleId, lines: [{ lineIndex, appliedDelta }] }),
      `sale_applied:${saleId}:${lineIndex}`,
      now,
    ]
  );
}

/**
 * One desired-state op per sale for the API voided flag (CR-06). INSERT OR
 * REPLACE swaps in a fresh pending row (new id) even when an earlier void /
 * unvoid row for the sale is already done, so the latest intent always syncs.
 */
export async function upsertSetVoided(
  db: SQLite.SQLiteDatabase,
  id: string,
  saleId: string,
  voided: boolean,
  now: number
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
    [id, SALE_SET_VOIDED, JSON.stringify({ saleId, voided }), `sale_set_voided:${saleId}`, now]
  );
}

/** Marks a row as permanently failed (non-retryable); it no longer counts as pending. */
export async function markOutboxFailed(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(`UPDATE outbox SET status = 'failed' WHERE id = ?`, [id]);
}

/**
 * Marks a row done only if its payload is still the one that was sent: a
 * sale_applied row re-upserted with a newer value while the request was in
 * flight must stay pending (CR-03).
 */
export async function markOutboxDoneIfPayload(
  db: SQLite.SQLiteDatabase,
  id: string,
  payload: string
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox SET status = 'done' WHERE id = ? AND payload = ?`,
    [id, payload]
  );
}

/** Replaces an outbox row's payload (e.g. to persist a stock op plan). */
export async function updateOutboxPayload(
  db: SQLite.SQLiteDatabase,
  id: string,
  payload: string
): Promise<void> {
  await db.runAsync(`UPDATE outbox SET payload = ? WHERE id = ?`, [payload, id]);
}

/**
 * Replaces a payload only while the row is still pending. Returns false when
 * the row was cancelled/finished meanwhile (e.g. a void cancelled an unplanned
 * deduct) - the caller must then NOT execute it (CR-01).
 */
export async function updatePendingOutboxPayload(
  db: SQLite.SQLiteDatabase,
  id: string,
  payload: string
): Promise<boolean> {
  const r = await db.runAsync(
    `UPDATE outbox SET payload = ? WHERE id = ? AND status = 'pending'`,
    [payload, id]
  );
  return (r?.changes ?? 0) > 0;
}

/** Fresh read of one outbox row (null if missing). */
export async function getOutboxRow(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<OutboxRow | null> {
  return (await db.getFirstAsync<OutboxRow>(`SELECT * FROM outbox WHERE id = ?`, [id])) ?? null;
}

/** All pending rows regardless of next_attempt_at, ordered by creation time. */
export async function getAllPendingOutboxRows(
  db: SQLite.SQLiteDatabase
): Promise<OutboxRow[]> {
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC`
  );
}

/**
 * Returns pending outbox rows where next_attempt_at <= now, ordered by creation time.
 */
export async function getPendingOutboxRows(
  db: SQLite.SQLiteDatabase
): Promise<OutboxRow[]> {
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'pending' AND next_attempt_at <= ?
     ORDER BY created_at ASC`,
    [Date.now()]
  );
}

/**
 * Marks an outbox row as done after successful sync.
 * Rows are retained (not deleted) to keep an audit trail.
 */
export async function markOutboxDone(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox SET status = 'done' WHERE id = ?`,
    [id]
  );
}

/**
 * Increments attempt count and sets next_attempt_at for exponential backoff.
 */
export async function incrementAttempt(
  db: SQLite.SQLiteDatabase,
  id: string,
  nextAttemptAt: number
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox SET attempt_count = attempt_count + 1, next_attempt_at = ? WHERE id = ?`,
    [nextAttemptAt, id]
  );
}
