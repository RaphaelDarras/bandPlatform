import * as SQLite from 'expo-sqlite';

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
  productId: string;
  variantSku: string;
  quantity: number;
  priceAtSale: number;
}

export interface LocalSale {
  id: string;
  concertId: string;
  items: LocalSaleItem[];
  totalAmount: number;
  paymentMethod: string;
  currency: string;
  discount: number;
  discountType: 'flat' | 'percent';
}

type OutboxEntryInput = Omit<OutboxRow, 'status' | 'attempt_count' | 'next_attempt_at'>;

/**
 * Atomic write: sale + outbox in one transaction.
 * This is called the instant the user taps "Confirm" — write is the first operation.
 */
export async function recordSaleLocally(
  db: SQLite.SQLiteDatabase,
  sale: LocalSale,
  outboxEntry: OutboxEntryInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sales (id, concert_id, items_json, total_amount, payment_method,
        currency, discount, discount_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sale.id,
        sale.concertId,
        JSON.stringify(sale.items),
        sale.totalAmount,
        sale.paymentMethod,
        sale.currency,
        sale.discount,
        sale.discountType,
        Date.now(),
      ]
    );
    // INSERT OR IGNORE prevents duplicate on retry
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
      [
        outboxEntry.id,
        outboxEntry.type,
        outboxEntry.payload,
        outboxEntry.idempotency_key,
        outboxEntry.created_at,
      ]
    );
  });
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
