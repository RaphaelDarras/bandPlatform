import {
  recordSaleLocally,
  getPendingOutboxRows,
  markOutboxDone,
  incrementAttempt,
  insertOutboxEntries,
  updateOutboxPayload,
  getAllPendingOutboxRows,
  updatePendingOutboxPayload,
  upsertSaleApplied,
  upsertSetVoided,
  markOutboxFailed,
  markOutboxDoneIfPayload,
} from '@/db/outbox';
import type { LocalSale } from '@/db/outbox';

const mockDb = {
  execAsync: jest.fn(() => Promise.resolve()),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  getAllAsync: jest.fn(() => Promise.resolve([])),
};

const mockSale: LocalSale = {
  id: 'sale-uuid-1',
  concertId: 'concert-1',
  items: [
    {
      productGid: 'gid://shopify/Product/1',
      variantGid: 'gid://shopify/ProductVariant/2',
      productName: 'Tee',
      variantLabel: 'M',
      variantSku: 'p1-m',
      quantity: 2,
      priceAtSale: 15,
    },
  ],
  totalAmount: 30,
  paymentMethod: 'cash',
  currency: 'EUR',
  discount: 0,
  discountType: 'flat',
};

const mockOutboxEntry = {
  id: 'outbox-uuid-1',
  type: 'sale_create',
  payload: JSON.stringify(mockSale),
  idempotency_key: 'sale_create:sale-uuid-1',
  created_at: 1700000000000,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recordSaleLocally', () => {
  it('wraps writes in BEGIN/COMMIT', async () => {
    await recordSaleLocally(mockDb as any, mockSale, [mockOutboxEntry]);
    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('inserts into sales table with correct fields', async () => {
    await recordSaleLocally(mockDb as any, mockSale, [mockOutboxEntry]);
    const insertSaleCall = (mockDb.runAsync.mock.calls as any[][]).find((call) =>
      call[0].includes('INSERT INTO sales')
    );
    expect(insertSaleCall).toBeDefined();
    expect(insertSaleCall![1]).toEqual(
      expect.arrayContaining([
        mockSale.id,
        mockSale.concertId,
        JSON.stringify(mockSale.items),
        mockSale.totalAmount,
        mockSale.paymentMethod,
        mockSale.currency,
        mockSale.discount,
        mockSale.discountType,
      ])
    );
  });

  it('inserts into outbox table with idempotency key', async () => {
    await recordSaleLocally(mockDb as any, mockSale, [mockOutboxEntry]);
    const insertOutboxCall = (mockDb.runAsync.mock.calls as any[][]).find((call) =>
      call[0].includes('INSERT OR IGNORE INTO outbox')
    );
    expect(insertOutboxCall).toBeDefined();
    expect(insertOutboxCall![1]).toEqual(
      expect.arrayContaining([
        mockOutboxEntry.id,
        mockOutboxEntry.type,
        mockOutboxEntry.payload,
        mockOutboxEntry.idempotency_key,
      ])
    );
  });
});

describe('recordSaleLocally multi-entry', () => {
  const e2 = { ...mockOutboxEntry, id: 'o2', idempotency_key: 'k2' };
  const e3 = { ...mockOutboxEntry, id: 'o3', idempotency_key: 'k3' };

  it('writes one sale row and three outbox rows in one transaction', async () => {
    await recordSaleLocally(mockDb as any, mockSale, [mockOutboxEntry, e2, e3]);
    const calls = (mockDb.runAsync.mock.calls as any[][]).map((c) => c[0] as string);
    expect(calls.filter((c) => c.includes('INSERT INTO sales'))).toHaveLength(1);
    expect(calls.filter((c) => c.includes('INSERT OR IGNORE INTO outbox'))).toHaveLength(3);
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('persists snapshot fields in items_json', async () => {
    await recordSaleLocally(mockDb as any, mockSale, [mockOutboxEntry]);
    const call = (mockDb.runAsync.mock.calls as any[][]).find((c) =>
      c[0].includes('INSERT INTO sales')
    );
    const items = JSON.parse(call![1][2]);
    expect(items[0]).toEqual(
      expect.objectContaining({
        productGid: 'gid://shopify/Product/1',
        variantGid: 'gid://shopify/ProductVariant/2',
        productName: 'Tee',
        variantLabel: 'M',
        variantSku: 'p1-m',
        quantity: 2,
        priceAtSale: 15,
      })
    );
  });

  it('rolls back and rethrows when a later outbox insert fails', async () => {
    let n = 0;
    (mockDb.runAsync as jest.Mock).mockImplementation(() => {
      n += 1;
      if (n === 3) return Promise.reject(new Error('boom'));
      return Promise.resolve({ lastInsertRowId: 1, changes: 1 });
    });
    await expect(
      recordSaleLocally(mockDb as any, mockSale, [mockOutboxEntry, e2, e3])
    ).rejects.toThrow('boom');
    expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
    expect(mockDb.execAsync).not.toHaveBeenCalledWith('COMMIT');
    (mockDb.runAsync as jest.Mock).mockImplementation(() =>
      Promise.resolve({ lastInsertRowId: 1, changes: 1 })
    );
  });
});

describe('insertOutboxEntries', () => {
  it('inserts each entry as pending with zero attempts', async () => {
    await insertOutboxEntries(mockDb as any, [
      mockOutboxEntry,
      { ...mockOutboxEntry, id: 'x', idempotency_key: 'y' },
    ]);
    const calls = mockDb.runAsync.mock.calls as any[][];
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toContain("'pending', 0, 0");
  });
});

describe('updateOutboxPayload', () => {
  it('updates payload by id', async () => {
    await updateOutboxPayload(mockDb as any, 'id1', '{"a":1}');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE outbox SET payload = ? WHERE id = ?',
      ['{"a":1}', 'id1']
    );
  });
});

describe('getAllPendingOutboxRows', () => {
  it('selects pending rows without next_attempt_at filter, ordered by created_at', async () => {
    await getAllPendingOutboxRows(mockDb as any);
    const sql = (mockDb.getAllAsync.mock.calls as any[][])[0][0] as string;
    expect(sql).toContain("status = 'pending'");
    expect(sql).not.toContain('next_attempt_at');
    expect(sql).toContain('ORDER BY created_at ASC');
  });
});

describe('getPendingOutboxRows', () => {
  it('queries outbox for pending rows where next_attempt_at <= now', async () => {
    await getPendingOutboxRows(mockDb as any);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'pending'"),
      expect.arrayContaining([expect.any(Number)])
    );
  });

  it('returns rows from the database', async () => {
    const rows = [{ id: '1', status: 'pending' }] as any;
    (mockDb.getAllAsync as jest.Mock).mockResolvedValueOnce(rows);
    const result = await getPendingOutboxRows(mockDb as any);
    expect(result).toEqual(rows);
  });
});

describe('markOutboxDone', () => {
  it('updates outbox row status to done', async () => {
    await markOutboxDone(mockDb as any, 'outbox-id-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'done'"),
      expect.arrayContaining(['outbox-id-1'])
    );
  });
});

describe('incrementAttempt', () => {
  it('updates attempt_count and next_attempt_at', async () => {
    const nextAttempt = Date.now() + 2000;
    await incrementAttempt(mockDb as any, 'outbox-id-1', nextAttempt);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('attempt_count'),
      expect.arrayContaining([nextAttempt, 'outbox-id-1'])
    );
  });
});

describe('updatePendingOutboxPayload (CR-01)', () => {
  it('only writes while the row is pending and reports whether it did', async () => {
    mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 0, changes: 0 });
    expect(await updatePendingOutboxPayload(mockDb as any, 'r1', '{}')).toBe(false);
    expect((mockDb.runAsync.mock.calls.at(-1) as any[])[0]).toContain("status = 'pending'");
    expect(await updatePendingOutboxPayload(mockDb as any, 'r1', '{}')).toBe(true);
  });
});

describe('sale_applied upsert (CR-03)', () => {
  it('keys one row per sale line and returns it to pending with the current value', async () => {
    await upsertSaleApplied(mockDb as any, 'id-1', 's1', 2, -3, 1000);
    const [sql, params] = mockDb.runAsync.mock.calls.at(-1) as any[];
    expect(sql).toContain('ON CONFLICT(idempotency_key) DO UPDATE');
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('payload = excluded.payload');
    expect(params[3]).toBe('sale_applied:s1:2');
    expect(JSON.parse(params[2])).toEqual({ saleId: 's1', lines: [{ lineIndex: 2, appliedDelta: -3 }] });
  });

  it('marks done only if the payload is unchanged', async () => {
    await markOutboxDoneIfPayload(mockDb as any, 'id-1', '{"a":1}');
    const [sql, params] = mockDb.runAsync.mock.calls.at(-1) as any[];
    expect(sql).toContain('AND payload = ?');
    expect(params).toEqual(['id-1', '{"a":1}']);
  });
});

describe('sale_set_voided op (CR-06)', () => {
  it('replaces any earlier row for the sale (even a done one) with a pending one', async () => {
    await upsertSetVoided(mockDb as any, 'id-2', 's1', false, 1000);
    const [sql, params] = mockDb.runAsync.mock.calls.at(-1) as any[];
    expect(sql).toContain('INSERT OR REPLACE INTO outbox');
    expect(params).toEqual([
      'id-2',
      'sale_set_voided',
      JSON.stringify({ saleId: 's1', voided: false }),
      'sale_set_voided:s1',
      1000,
    ]);
  });

  it('markOutboxFailed sets status failed', async () => {
    await markOutboxFailed(mockDb as any, 'id-3');
    const [sql, params] = mockDb.runAsync.mock.calls.at(-1) as any[];
    expect(sql).toContain("status = 'failed'");
    expect(params).toEqual(['id-3']);
  });
});
