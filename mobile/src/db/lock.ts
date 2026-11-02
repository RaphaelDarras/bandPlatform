import type * as SQLite from 'expo-sqlite';

/**
 * Single JS mutex for every multi-statement SQLite writer (07.1 CR-04).
 *
 * getDb() hands out ONE expo-sqlite connection. A manual BEGIN on it is joined
 * by every other async caller, so two flows that each BEGIN/COMMIT interleave:
 * nested BEGIN fails, one flow's ROLLBACK undoes the other's writes, and a
 * read-modify-write can lose a concurrent update. Every transaction and every
 * read-modify-write critical section runs behind this lock instead.
 *
 * NOT re-entrant: never call withDbLock / runInTransaction from inside fn.
 */
let tail: Promise<unknown> = Promise.resolve();

export function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}

/** BEGIN/COMMIT (ROLLBACK on error) behind the shared lock. */
export function runInTransaction<T>(
  db: SQLite.SQLiteDatabase,
  fn: () => Promise<T>
): Promise<T> {
  return withDbLock(async () => {
    await db.execAsync('BEGIN');
    try {
      const result = await fn();
      await db.execAsync('COMMIT');
      return result;
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }
  });
}
