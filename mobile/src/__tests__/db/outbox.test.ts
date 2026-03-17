import { recordSaleLocally, getPendingOutboxRows, markOutboxDone, incrementAttempt } from '@/db/outbox';
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
  items: [{ productId: 'p1', variantSku: 'p1-m', quantity: 2, priceAtSale: 15 }],
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
    await recordSaleLocally(mockDb as any, mockSale, mockOutboxEntry);
    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
  });

  it('inserts into sales table with correct fields', async () => {
    await recordSaleLocally(mockDb as any, mockSale, mockOutboxEntry);
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
    await recordSaleLocally(mockDb as any, mockSale, mockOutboxEntry);
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
