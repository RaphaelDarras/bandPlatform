import * as SQLite from 'expo-sqlite';
import type { LocalSale } from './outbox';

export interface LocalSaleRow extends Omit<LocalSale, 'items'> {
  items_json: string;
  voided: number;
  voided_at: number | null;
  synced: number;
  created_at: number;
}

/**
 * Returns local sales, optionally filtered by concert, sorted by newest first.
 */
export async function getLocalSales(
  db: SQLite.SQLiteDatabase,
  concertId?: string
): Promise<LocalSaleRow[]> {
  if (concertId !== undefined) {
    return db.getAllAsync<LocalSaleRow>(
      `SELECT * FROM sales WHERE concert_id = ? ORDER BY created_at DESC`,
      [concertId]
    );
  }
  return db.getAllAsync<LocalSaleRow>(
    `SELECT * FROM sales ORDER BY created_at DESC`
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
