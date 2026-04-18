import * as SQLite from 'expo-sqlite';

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      concert_id TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_split_json TEXT,
      currency TEXT NOT NULL DEFAULT 'EUR',
      discount REAL NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'flat',
      voided INTEGER NOT NULL DEFAULT 0,
      voided_at INTEGER,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sales_concert_idx ON sales(concert_id);
    CREATE INDEX IF NOT EXISTS sales_created_idx ON sales(created_at DESC);

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS outbox_idem_idx ON outbox(idempotency_key);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      variants_json TEXT NOT NULL DEFAULT '[]',
      image_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concerts (
      id TEXT PRIMARY KEY,
      date INTEGER NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      venue TEXT,
      city TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concert_price_overrides (
      concert_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      price REAL NOT NULL,
      PRIMARY KEY (concert_id, product_id)
    );
  `);

  // Migrate existing concerts table: add country, drop name, add currency
  try { await db.execAsync(`ALTER TABLE concerts ADD COLUMN country TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await db.execAsync(`ALTER TABLE concerts DROP COLUMN name`); } catch {}
  try { await db.execAsync(`ALTER TABLE concerts ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'`); } catch {}
  // Remove rows with null id (accumulated before _id→id mapping was fixed)
  try { await db.execAsync(`DELETE FROM concerts WHERE id IS NULL`); } catch {}

  // Migrate existing sales table: add payment_split_json for split-payment breakdown
  try { await db.execAsync(`ALTER TABLE sales ADD COLUMN payment_split_json TEXT`); } catch {}
}
