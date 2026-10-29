import {
  buildDeductEntries,
  buildRestockEntry,
  enqueueVoidRestores,
  enqueueUnvoidDeducts,
} from '@/db/stockOps';
import type { LocalSaleItem, OutboxRow } from '@/db/outbox';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'mock-uuid') }));

const mockDb = {
  execAsync: jest.fn(() => Promise.resolve()),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  getAllAsync: jest.fn((): Promise<any[]> => Promise.resolve([])),
};

function seqIds(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

const lineA: LocalSaleItem = {
  variantGid: 'g1',
  variantSku: 'a',
  quantity: 2,
  priceAtSale: 10,
};
const legacy: LocalSaleItem = { productId: 'old', variantSku: 'b', quantity: 5, priceAtSale: 10 };
const lineC: LocalSaleItem = {
  variantGid: 'g3',
  variantSku: 'c',
  quantity: 1,
  priceAtSale: 10,
};

function pendingRow(id: string, payload: object): OutboxRow {
  return {
    id,
    type: 'shopify_stock',
    payload: JSON.stringify(payload),
    idempotency_key: `k-${id}`,
    status: 'pending',
    attempt_count: 0,
    next_attempt_at: 0,
    created_at: 1,
  };
}

function insertedPayloads(): any[] {
  return (mockDb.runAsync.mock.calls as any[][])
    .filter((c) => c[0].includes('INSERT OR IGNORE INTO outbox'))
    .map((c) => ({ params: c[1], payload: JSON.parse(c[1][2]) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockImplementation(() => Promise.resolve([]));
});

describe('buildDeductEntries', () => {
  it('builds one entry per line with a variantGid', () => {
    const entries = buildDeductEntries('s1', [lineA, legacy, lineC], 1000, seqIds());
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.idempotency_key)).toEqual([
      'shopify_stock:s1:0:deduct',
      'shopify_stock:s1:2:deduct',
    ]);
    expect(entries.map((e) => e.created_at)).toEqual([1001, 1003]);
    expect(entries.every((e) => e.type === 'shopify_stock')).toBe(true);
    const payloads = entries.map((e) => JSON.parse(e.payload));
    expect(payloads.map((p) => p.kind)).toEqual(['deduct', 'deduct']);
    expect(payloads.map((p) => p.requested)).toEqual([2, 1]);
    expect(payloads.map((p) => p.lineIndex)).toEqual([0, 2]);
  });
});

describe('buildRestockEntry', () => {
  it('builds a restock entry', () => {
    const e = buildRestockEntry('g1', -3, 'damaged', 1000, () => 'r1');
    expect(e.idempotency_key).toBe('shopify_stock:restock:r1');
    expect(e.id).toBe('r1');
    expect(JSON.parse(e.payload)).toEqual({
      kind: 'restock',
      variantGid: 'g1',
      requested: -3,
      note: 'damaged',
    });
  });
});

describe('enqueueVoidRestores', () => {
  it('cancels a pending unplanned deduct instead of queueing a restore', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      pendingRow('d0', { kind: 'deduct', variantGid: 'g1', saleId: 's1', lineIndex: 0, requested: 2 }),
    ]);
    const r = await enqueueVoidRestores(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(r).toEqual({ cancelled: 1, enqueued: 0 });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'done'"),
      ['d0']
    );
    expect(insertedPayloads()).toHaveLength(0);
  });

  it('cancels a pending unplanned unvoid too', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      pendingRow('u0', { kind: 'unvoid', variantGid: 'g1', saleId: 's1', lineIndex: 0, requested: 2 }),
    ]);
    const r = await enqueueVoidRestores(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(r).toEqual({ cancelled: 1, enqueued: 0 });
  });

  it('queues a restore when the deduct is in flight (has a plan)', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      pendingRow('d0', {
        kind: 'deduct',
        variantGid: 'g1',
        saleId: 's1',
        lineIndex: 0,
        requested: 2,
        plan: { inventoryItemId: 'i', changeFrom: 5, delta: -2, key: 'd0' },
      }),
    ]);
    const r = await enqueueVoidRestores(
      mockDb as any,
      's1',
      [{ ...lineA, appliedDelta: -1 }],
      1000,
      seqIds()
    );
    expect(r).toEqual({ cancelled: 0, enqueued: 1 });
    const ins = insertedPayloads();
    expect(ins[0].payload.kind).toBe('restore');
    expect(ins[0].payload.requested).toBe(1);
    expect(ins[0].params[3]).toBe('shopify_stock:s1:0:restore:id1');
  });

  it('queues a restore with quantity when appliedDelta is unknown and deduct already done', async () => {
    const r = await enqueueVoidRestores(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(r).toEqual({ cancelled: 0, enqueued: 1 });
    expect(insertedPayloads()[0].payload.requested).toBe(2);
  });

  it('skips legacy lines without variantGid', async () => {
    const r = await enqueueVoidRestores(mockDb as any, 's1', [legacy], 1000, seqIds());
    expect(r).toEqual({ cancelled: 0, enqueued: 0 });
    expect(insertedPayloads()).toHaveLength(0);
  });

  it('ignores rows with unparsable payloads and other sales', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { ...pendingRow('bad', {}), payload: 'not json' },
      pendingRow('other', { kind: 'deduct', variantGid: 'g1', saleId: 's2', lineIndex: 0, requested: 2 }),
    ]);
    const r = await enqueueVoidRestores(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(r).toEqual({ cancelled: 0, enqueued: 1 });
  });

  it('runs inside BEGIN/COMMIT and rolls back on failure', async () => {
    await enqueueVoidRestores(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');

    jest.clearAllMocks();
    mockDb.getAllAsync.mockImplementation(() => Promise.resolve([]));
    mockDb.runAsync.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    await expect(
      enqueueVoidRestores(mockDb as any, 's1', [lineA], 1000, seqIds())
    ).rejects.toThrow('boom');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('enqueueUnvoidDeducts', () => {
  it('cancels a pending unplanned restore (net zero)', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      pendingRow('r0', { kind: 'restore', variantGid: 'g1', saleId: 's1', lineIndex: 0, requested: 2 }),
    ]);
    const r = await enqueueUnvoidDeducts(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(r).toEqual({ cancelled: 1, enqueued: 0 });
    expect(insertedPayloads()).toHaveLength(0);
  });

  it('inserts an unvoid row with quantity when nothing to cancel', async () => {
    const r = await enqueueUnvoidDeducts(
      mockDb as any,
      's1',
      [{ ...lineA, appliedDelta: 0 }, legacy, lineC],
      1000,
      seqIds()
    );
    expect(r).toEqual({ cancelled: 0, enqueued: 2 });
    const ins = insertedPayloads();
    expect(ins[0].payload).toEqual(
      expect.objectContaining({ kind: 'unvoid', requested: 2, lineIndex: 0 })
    );
    expect(ins[0].params[3]).toBe('shopify_stock:s1:0:unvoid:id1');
    expect(ins[1].params[3]).toBe('shopify_stock:s1:2:unvoid:id2');
  });

  it('queues unvoid when the pending restore is in flight (has a plan)', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      pendingRow('r0', {
        kind: 'restore',
        variantGid: 'g1',
        saleId: 's1',
        lineIndex: 0,
        requested: 2,
        plan: { inventoryItemId: 'i', changeFrom: null, delta: 2, key: 'r0' },
      }),
    ]);
    const r = await enqueueUnvoidDeducts(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(r).toEqual({ cancelled: 0, enqueued: 1 });
  });

  it('runs inside BEGIN/COMMIT', async () => {
    await enqueueUnvoidDeducts(mockDb as any, 's1', [lineA], 1000, seqIds());
    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });
});
