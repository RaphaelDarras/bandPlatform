import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let _db: SQLite.SQLiteDatabase | null = null;
let _opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  // If we have a cached connection, verify it is still alive before returning it.
  if (_db) {
    try {
      await _db.getFirstAsync('SELECT 1');
      return _db;
    } catch {
      // Native connection has become invalid (e.g. JS reload in dev, Android lifecycle).
      // Reset so we fall through to a fresh open.
      _db = null;
      _opening = null;
    }
  }

  // If an open is already in flight, reuse it.
  if (_opening) return _opening;

  _opening = (async () => {
    const db = await SQLite.openDatabaseAsync('pos.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await runMigrations(db);
    _db = db;
    return db;
  })();

  // Clear the in-flight promise on failure so the next caller gets a fresh attempt.
  _opening.catch(() => {
    _opening = null;
  });

  return _opening;
}
