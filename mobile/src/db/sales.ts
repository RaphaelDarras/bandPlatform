import * as SQLite from 'expo-sqlite';
import type { LocalSale } from './outbox';

export interface LocalSaleRow extends Omit<LocalSale, 'items'> {
  items_json: string;
  voided: number;
  voided_at: number | null;
  synced: number;
  created_at: number;
  // Aliased camelCase columns from SELECT aliases (SQLite returns snake_case by default)
  discountType: 'flat' | 'percent';
  totalAmount: number;
  paymentMethod: string;
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
    discount_type   AS discountType,
    total_amount    AS totalAmount,
    payment_method  AS paymentMethod,
    concert_id      AS concertId,
    created_at      AS createdAt,
    voided_at       AS voidedAt,
    items_json      AS itemsJson
  `;
  if (concertId !== undefined) {
    return db.getAllAsync<LocalSaleRow>(
      `SELECT ${selectCols} FROM sales WHERE concert_id = ? ORDER BY created_at DESC`,
      [concertId]
    );
  }
  return db.getAllAsync<LocalSaleRow>(
    `SELECT ${selectCols} FROM sales ORDER BY created_at DESC`
  );
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
