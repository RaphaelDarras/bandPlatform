import * as SQLite from 'expo-sqlite';
import { runInTransaction } from './lock';

/**
 * The outbox holds two independent op families (D-14):
 *  - API (Mongo): sale_create / sale_void / sale_unvoid / sale_update_concert / sale_applied
 *  - Shopify:     shopify_stock (one row per sale line / restock)
 */
export const SHOPIFY_STOCK = 'shopify_stock';
export const SALE_APPLIED = 'sale_applied';

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

/** Replaces an outbox row's payload (e.g. to persist a stock op plan). */
export async function updateOutboxPayload(
  db: SQLite.SQLiteDatabase,
  id: string,
  payload: string
): Promise<void> {
  await db.runAsync(`UPDATE outbox SET payload = ? WHERE id = ?`, [payload, id]);
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
