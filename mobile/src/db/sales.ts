import * as SQLite from 'expo-sqlite';
import type { LocalSale, PaymentSplitEntry } from './outbox';
import type { ApiSale } from '@/api/sales';

export interface LocalSaleRow extends Omit<LocalSale, 'items' | 'paymentSplit'> {
  items_json: string;
  voided: number;
  voided_at: number | null;
  synced: number;
  created_at: number;
  // Aliased camelCase columns from SELECT aliases (SQLite returns snake_case by default)
  discountType: 'flat' | 'percent';
  totalAmount: number;
  paymentMethod: string;
  /** Raw JSON string from payment_split_json column; may be null/undefined. */
  payment_split_json: string | null;
  paymentSplitJson: string | null;
  /** Parsed split entries, populated by getLocalSales. Undefined when not a split sale. */
  paymentSplit?: PaymentSplitEntry[];
  concertId: string;
  createdAt: number;
  voidedAt: number | null;
  itemsJson: string;
}

/**
 * Returns local sales, optionally filtered by concert, sorted by newest first.
 */
export async function getLocalSales(
  db: SQLite.SQLiteDatabase,
  concertId?: string
): Promise<LocalSaleRow[]> {
  const selectCols = `
    *,
    discount_type       AS discountType,
    total_amount        AS totalAmount,
    payment_method      AS paymentMethod,
    payment_split_json  AS paymentSplitJson,
    concert_id          AS concertId,
    created_at          AS createdAt,
    voided_at           AS voidedAt,
    items_json          AS itemsJson
  `;
  const rows = concertId !== undefined
    ? await db.getAllAsync<LocalSaleRow>(
        `SELECT ${selectCols} FROM sales WHERE concert_id = ? ORDER BY created_at DESC`,
        [concertId]
      )
    : await db.getAllAsync<LocalSaleRow>(
        `SELECT ${selectCols} FROM sales ORDER BY created_at DESC`
      );
  // Parse payment_split_json into paymentSplit array for consumers
  for (const row of rows) {
    const raw = row.paymentSplitJson ?? row.payment_split_json ?? null;
    if (raw) {
      try {
        row.paymentSplit = JSON.parse(raw) as PaymentSplitEntry[];
      } catch {
        row.paymentSplit = undefined;
      }
    }
  }
  return rows;
}

/**
 * Voids a local sale by setting voided=1 and recording voided_at timestamp.
 */
export async function voidLocalSale(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE sales SET voided = 1, voided_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}

/**
 * Updates the concert_id for a local sale.
 */
export async function updateSaleConcert(
  db: SQLite.SQLiteDatabase,
  id: string,
  concertId: string
): Promise<void> {
  await db.runAsync(
    `UPDATE sales SET concert_id = ? WHERE id = ?`,
    [concertId, id]
  );
}

/**
 * Unvoids a local sale (reversal).
 */
export async function unvoidLocalSale(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE sales SET voided = 0, voided_at = NULL WHERE id = ?`,
    [id]
  );
}

/**
 * Extracts the local UUID from an idempotencyKey like "sale_create:<uuid>".
 * Returns null if the key doesn't match the POS pattern.
 */
function localIdFromKey(key?: string | null): string | null {
  if (!key) return null;
  const prefix = 'sale_create:';
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

/**
 * Reconciles local sales with server state:
 * 1. Upserts all server sales into SQLite (server wins for synced data)
 * 2. Deletes local sales that no longer exist on the server,
 *    EXCEPT sales still pending in the outbox (not yet synced).
 */
export async function reconcileSalesFromServer(
  db: SQLite.SQLiteDatabase,
  serverSales: ApiSale[]
): Promise<void> {
  // Build set of local IDs that the server knows about
  const serverLocalIds = new Set<string>();

  await db.execAsync('BEGIN');
  try {
    for (const sale of serverSales) {
      const localId = localIdFromKey(sale.idempotencyKey) ?? sale.id;
      serverLocalIds.add(localId);

      const voided = sale.voidedAt ? 1 : 0;
      const voidedAt = sale.voidedAt ? new Date(sale.voidedAt).getTime() : null;
      const createdAt = new Date(sale.createdAt).getTime();
      const itemsJson = JSON.stringify(
        sale.items.map((i) => ({
          productId: i.productId,
          variantSku: i.variantSku,
          quantity: i.quantity,
          priceAtSale: i.priceAtSale,
        }))
      );

      const paymentSplitJson = sale.paymentSplit && Array.isArray(sale.paymentSplit) && sale.paymentSplit.length > 0
        ? JSON.stringify(sale.paymentSplit)
        : null;
      await db.runAsync(
        `INSERT OR REPLACE INTO sales
         (id, concert_id, items_json, total_amount, payment_method, payment_split_json,
          currency, discount, discount_type, voided, voided_at, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          localId,
          sale.concertId ?? '',
          itemsJson,
          sale.totalAmount,
          sale.paymentMethod,
          paymentSplitJson,
          sale.currency,
          sale.discount ?? 0,
          sale.discountType ?? 'flat',
          voided,
          voidedAt,
          createdAt,
        ]
      );
    }

    // Get IDs of sales still pending in outbox (not yet confirmed by server)
    const pendingRows = await db.getAllAsync<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM outbox WHERE type = 'sale_create' AND status = 'pending'`
    );
    const pendingIds = new Set<string>();
    for (const row of pendingRows) {
      const id = localIdFromKey(row.idempotency_key);
      if (id) pendingIds.add(id);
    }

    // Delete local sales not on server and not pending sync
    const allLocal = await db.getAllAsync<{ id: string }>(`SELECT id FROM sales`);
    for (const row of allLocal) {
      if (!serverLocalIds.has(row.id) && !pendingIds.has(row.id)) {
        await db.runAsync(`DELETE FROM sales WHERE id = ?`, [row.id]);
      }
    }

    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
