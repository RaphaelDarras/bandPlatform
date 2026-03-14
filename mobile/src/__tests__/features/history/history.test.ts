/**
 * Tests for useHistory hook logic.
 * TDD RED phase — written before implementation.
 *
 * Tests grouping, sorting, voidSale, and unvoidSale logic.
 */
import { act, renderHook } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ saleId: 'sale-1' })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('outbox-uuid'),
}));

import { useHistory } from '@/features/history/useHistory';
import * as salesModule from '@/db/sales';
import * as productsModule from '@/db/products';
import * as outboxModule from '@/db/outbox';
import * as dbModule from '@/db';

// Mock db modules
jest.mock('@/db', () => ({
  getDb: jest.fn(() => Promise.resolve({ _mock: 'db' })),
}));

jest.mock('@/db/sales', () => ({
  getLocalSales: jest.fn(() => Promise.resolve([])),
  voidLocalSale: jest.fn(() => Promise.resolve()),
  unvoidLocalSale: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/db/products', () => ({
  updateLocalStock: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/db/outbox', () => ({
  recordSaleLocally: jest.fn(() => Promise.resolve()),
}));

// Mock the concerts cache
jest.mock('@/db/concerts', () => ({
  getCachedConcerts: jest.fn(() =>
    Promise.resolve([
      { id: 'concert-1', name: 'Summer Night', venue: 'The Fillmore', city: 'SF', date: 1700000000000, active: 0, updated_at: 1700000000000 },
      { id: 'concert-2', name: 'Winter Tour', venue: 'Madison Square Garden', city: 'NY', date: 1710000000000, active: 0, updated_at: 1710000000000 },
    ])
  ),
}));

// Mock outbox insert helper (used by voidSale/unvoidSale)
jest.mock('@/db/outbox', () => ({
  recordSaleLocally: jest.fn(() => Promise.resolve()),
  getPendingOutboxRows: jest.fn(() => Promise.resolve([])),
  markOutboxDone: jest.fn(() => Promise.resolve()),
  incrementAttempt: jest.fn(() => Promise.resolve()),
}));

const mockGetLocalSales = salesModule.getLocalSales as jest.Mock;
const mockVoidLocalSale = salesModule.voidLocalSale as jest.Mock;
const mockUnvoidLocalSale = salesModule.unvoidLocalSale as jest.Mock;
const mockUpdateLocalStock = productsModule.updateLocalStock as jest.Mock;

// Build a mock LocalSaleRow
function makeSaleRow(overrides: Partial<{
  id: string;
  concertId: string;
  items_json: string;
  total_amount: number;
  payment_method: string;
  currency: string;
  discount: number;
  discount_type: string;
  voided: number;
  voided_at: number | null;
  synced: number;
  created_at: number;
}> = {}) {
  return {
    id: 'sale-1',
    concertId: 'concert-1',
    items_json: JSON.stringify([
      { productId: 'prod-1', variantSku: 'SKU-S', quantity: 2, priceAtSale: 25 },
    ]),
    totalAmount: 50,
    paymentMethod: 'Cash',
    currency: 'EUR',
    discount: 0,
    discountType: 'flat',
    voided: 0,
    voided_at: null,
    synced: 0,
    created_at: 1700100000000,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const { v4 } = require('uuid');
  (v4 as jest.Mock).mockReturnValue('outbox-uuid');
  mockGetLocalSales.mockResolvedValue([]);
});

describe('useHistory — grouping and sorting', () => {
  it('groups sales by concertId', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({ id: 'sale-1', concertId: 'concert-1', created_at: 1700100000000 }),
      makeSaleRow({ id: 'sale-2', concertId: 'concert-2', created_at: 1710100000000 }),
      makeSaleRow({ id: 'sale-3', concertId: 'concert-1', created_at: 1700200000000 }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    const groups = result.current.salesByGroup;
    expect(Object.keys(groups)).toContain('concert-1');
    expect(Object.keys(groups)).toContain('concert-2');
    expect(groups['concert-1']).toHaveLength(2);
    expect(groups['concert-2']).toHaveLength(1);
  });

  it('sorts sales within each group by created_at desc (newest first)', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({ id: 'sale-1', concertId: 'concert-1', created_at: 1700100000000 }),
      makeSaleRow({ id: 'sale-2', concertId: 'concert-1', created_at: 1700300000000 }),
      makeSaleRow({ id: 'sale-3', concertId: 'concert-1', created_at: 1700200000000 }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    const group = result.current.salesByGroup['concert-1'];
    expect(group[0].id).toBe('sale-2'); // newest
    expect(group[1].id).toBe('sale-3');
    expect(group[2].id).toBe('sale-1'); // oldest
  });

  it('voided sales appear in the group with voided flag set', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({ id: 'sale-1', concertId: 'concert-1', voided: 0 }),
      makeSaleRow({ id: 'sale-2', concertId: 'concert-1', voided: 1 }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    const group = result.current.salesByGroup['concert-1'];
    const voided = group.find((s) => s.id === 'sale-2');
    expect(voided?.voided).toBe(1);
    expect(group).toHaveLength(2);
  });
});

describe('useHistory — voidSale', () => {
  it('calls voidLocalSale with the correct sale ID', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({ id: 'sale-1', concertId: 'concert-1', voided: 0 }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.voidSale('sale-1');
    });

    expect(mockVoidLocalSale).toHaveBeenCalledWith(expect.anything(), 'sale-1');
  });

  it('calls updateLocalStock to reverse stock (positive delta) for each item', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({
        id: 'sale-1',
        concertId: 'concert-1',
        voided: 0,
        items_json: JSON.stringify([
          { productId: 'prod-1', variantSku: 'SKU-S', quantity: 2, priceAtSale: 25 },
          { productId: 'prod-2', variantSku: 'SKU-L', quantity: 1, priceAtSale: 30 },
        ]),
      }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.voidSale('sale-1');
    });

    expect(mockUpdateLocalStock).toHaveBeenCalledWith(
      expect.anything(), 'prod-1', 'SKU-S', 2 // positive = add back
    );
    expect(mockUpdateLocalStock).toHaveBeenCalledWith(
      expect.anything(), 'prod-2', 'SKU-L', 1
    );
  });

  it('inserts an outbox entry with type sale_void when voiding', async () => {
    const mockRunAsync = jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 }));
    const mockDb = { runAsync: mockRunAsync, getAllAsync: jest.fn(() => Promise.resolve([])), withTransactionAsync: jest.fn((fn: () => Promise<void>) => fn()), execAsync: jest.fn(() => Promise.resolve()), getFirstAsync: jest.fn(() => Promise.resolve(null)) };
    (dbModule.getDb as jest.Mock).mockResolvedValue(mockDb);

    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({ id: 'sale-1', concertId: 'concert-1', voided: 0 }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.voidSale('sale-1');
    });

    // Should call runAsync to insert outbox entry with type sale_void
    const insertCalls = mockRunAsync.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('outbox')
    );
    expect(insertCalls.length).toBeGreaterThan(0);
    const outboxInsert = insertCalls.find(
      (call: unknown[]) => typeof call[1] === 'string' || (Array.isArray(call[1]) && call[1].includes('sale_void'))
    );
    expect(outboxInsert).toBeDefined();
  });
});

describe('useHistory — unvoidSale', () => {
  it('calls unvoidLocalSale with the correct sale ID', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({ id: 'sale-1', concertId: 'concert-1', voided: 1 }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.unvoidSale('sale-1');
    });

    expect(mockUnvoidLocalSale).toHaveBeenCalledWith(expect.anything(), 'sale-1');
  });

  it('calls updateLocalStock to re-deduct stock (negative delta) for each item when unvoiding', async () => {
    mockGetLocalSales.mockResolvedValue([
      makeSaleRow({
        id: 'sale-1',
        concertId: 'concert-1',
        voided: 1,
        items_json: JSON.stringify([
          { productId: 'prod-1', variantSku: 'SKU-S', quantity: 3, priceAtSale: 25 },
        ]),
      }),
    ]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.unvoidSale('sale-1');
    });

    expect(mockUpdateLocalStock).toHaveBeenCalledWith(
      expect.anything(), 'prod-1', 'SKU-S', -3 // negative = deduct again
    );
  });
});
