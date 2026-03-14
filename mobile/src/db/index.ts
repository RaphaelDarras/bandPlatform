import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('pos.db');
  // WAL mode improves concurrent read/write performance
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await runMigrations(_db);
  return _db;
}
