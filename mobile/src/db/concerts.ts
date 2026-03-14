import * as SQLite from 'expo-sqlite';

export interface CachedConcert {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  date: number; // Unix timestamp (ms)
  active: number; // 1 = active, 0 = closed
  updated_at: number;
}

/**
 * Returns all concerts ordered by date descending.
 */
export async function getCachedConcerts(
  db: SQLite.SQLiteDatabase
): Promise<CachedConcert[]> {
  return db.getAllAsync<CachedConcert>(
    'SELECT * FROM concerts ORDER BY date DESC'
  );
}

/**
 * Returns a single concert by ID, or null if not found.
 */
export async function getConcertById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<CachedConcert | null> {
  return db.getFirstAsync<CachedConcert>(
    'SELECT * FROM concerts WHERE id = ?',
    [id]
  );
}

/**
 * Upserts a batch of concerts from the API response into local SQLite cache.
 */
export async function upsertConcerts(
  db: SQLite.SQLiteDatabase,
  concerts: CachedConcert[]
): Promise<void> {
  for (const concert of concerts) {
    await db.runAsync(
      `INSERT OR REPLACE INTO concerts (id, name, venue, city, date, active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        concert.id,
        concert.name,
        concert.venue ?? null,
        concert.city ?? null,
        concert.date,
        concert.active,
        concert.updated_at,
      ]
    );
  }
}

/**
 * Upserts a single concert (used for create/update operations).
 */
export async function upsertConcert(
  db: SQLite.SQLiteDatabase,
  concert: CachedConcert
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO concerts (id, name, venue, city, date, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      concert.id,
      concert.name,
      concert.venue ?? null,
      concert.city ?? null,
      concert.date,
      concert.active,
      concert.updated_at,
    ]
  );
}

/**
 * Updates the active status of a concert in local cache.
 */
export async function updateConcertActive(
  db: SQLite.SQLiteDatabase,
  id: string,
  active: boolean
): Promise<void> {
  await db.runAsync(
    `UPDATE concerts SET active = ?, updated_at = ? WHERE id = ?`,
    [active ? 1 : 0, Date.now(), id]
  );
}

// --- Concert price overrides ---

export interface ConcertPriceOverride {
  concert_id: string;
  product_id: string;
  price: number;
}

/**
 * Returns all price overrides for a given concert.
 */
export async function getConcertPriceOverrides(
  db: SQLite.SQLiteDatabase,
  concertId: string
): Promise<ConcertPriceOverride[]> {
  return db.getAllAsync<ConcertPriceOverride>(
    'SELECT * FROM concert_price_overrides WHERE concert_id = ?',
    [concertId]
  );
}

/**
 * Upserts a price override for a specific concert + product pair.
 */
export async function upsertPriceOverride(
  db: SQLite.SQLiteDatabase,
  concertId: string,
  productId: string,
  price: number
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO concert_price_overrides (concert_id, product_id, price)
     VALUES (?, ?, ?)`,
    [concertId, productId, price]
  );
}

/**
 * Deletes a price override.
 */
export async function deletePriceOverride(
  db: SQLite.SQLiteDatabase,
  concertId: string,
  productId: string
): Promise<void> {
  await db.runAsync(
    `DELETE FROM concert_price_overrides WHERE concert_id = ? AND product_id = ?`,
    [concertId, productId]
  );
}
