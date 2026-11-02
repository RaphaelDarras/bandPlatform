import { runInTransaction, withDbLock } from '@/db/lock';

function makeDb(log: string[]) {
  return {
    execAsync: jest.fn(async (sql: string) => {
      log.push(sql);
    }),
  } as any;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('db lock (CR-04)', () => {
  it('serialises concurrent transactions on the shared connection', async () => {
    const log: string[] = [];
    const db = makeDb(log);
    await Promise.all([
      runInTransaction(db, async () => {
        log.push('a1');
        await tick();
        log.push('a2');
      }),
      runInTransaction(db, async () => {
        log.push('b1');
        await tick();
        log.push('b2');
      }),
    ]);
    expect(log).toEqual(['BEGIN', 'a1', 'a2', 'COMMIT', 'BEGIN', 'b1', 'b2', 'COMMIT']);
  });

  it("a failing flow's ROLLBACK cannot undo another flow's writes", async () => {
    const log: string[] = [];
    const db = makeDb(log);
    const failing = runInTransaction(db, async () => {
      log.push('a');
      await tick();
      throw new Error('boom');
    });
    const ok = runInTransaction(db, async () => {
      log.push('b');
    });
    await expect(failing).rejects.toThrow('boom');
    await ok;
    expect(log).toEqual(['BEGIN', 'a', 'ROLLBACK', 'BEGIN', 'b', 'COMMIT']);
  });

  it('a single locked write waits for an open transaction', async () => {
    const log: string[] = [];
    const db = makeDb(log);
    await Promise.all([
      runInTransaction(db, async () => {
        await tick();
        log.push('tx-write');
      }),
      withDbLock(async () => {
        log.push('single-write');
      }),
    ]);
    expect(log).toEqual(['BEGIN', 'tx-write', 'COMMIT', 'single-write']);
  });
});
