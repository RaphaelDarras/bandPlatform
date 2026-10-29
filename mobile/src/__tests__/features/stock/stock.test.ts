/**
 * Tests for useStock hook (Shopify-backed, phase 07.1).
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useStock } from '@/features/stock/useStock';
import * as productsModule from '@/db/products';
import * as catalogueModule from '@/features/stock/catalogue';
import * as outboxModule from '@/db/outbox';
import * as syncModule from '@/features/sync/SyncManager';

const mockDb = { tag: 'db' };

jest.mock('@/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));
jest.mock('@/db/products', () => ({
  getCachedProducts: jest.fn(() => Promise.resolve([])),
  updateLocalStock: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/stock/catalogue', () => ({
  refreshCatalogue: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/db/outbox', () => ({
  insertOutboxEntries: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/db/stockOps', () => ({
  buildRestockEntry: jest.fn((variantGid: string, delta: number, note: string, now: number) => ({
    id: 'r1',
    type: 'shopify_stock',
    payload: JSON.stringify({ kind: 'restock', variantGid, requested: delta, note }),
    idempotency_key: 'k',
    created_at: now,
  })),
}));
jest.mock('@/features/sync/SyncManager', () => ({
  requestSync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/api/client', () => ({ apiClient: { tag: 'client' } }));

const mockGetCached = productsModule.getCachedProducts as jest.Mock;
const mockRefreshCatalogue = catalogueModule.refreshCatalogue as jest.Mock;
const mockInsert = outboxModule.insertOutboxEntries as jest.Mock;
const mockRequestSync = syncModule.requestSync as jest.Mock;

function makeProduct() {
  return {
    id: 'P1',
    name: 'Tee',
    price: 25,
    imageUrl: null,
    active: 1,
    updatedAt: 1,
    variants: [{ variantGid: 'V1', sku: 'S', label: 'S', priceAdjustment: 0, stock: 5 }],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCached.mockResolvedValue([]);
  mockRefreshCatalogue.mockResolvedValue(true);
});

describe('useStock - refreshStock', () => {
  it('refreshes the catalogue then reads the cache', async () => {
    mockGetCached.mockResolvedValue([makeProduct()]);
    const { result } = renderHook(() => useStock());
    await act(async () => {
      await result.current.refreshStock();
    });
    expect(mockRefreshCatalogue).toHaveBeenCalledWith(mockDb);
    expect(result.current.products[0].name).toBe('Tee');
  });

  it('falls back to cache when refreshCatalogue returns false', async () => {
    mockRefreshCatalogue.mockResolvedValue(false);
    mockGetCached.mockResolvedValue([makeProduct()]);
    const { result } = renderHook(() => useStock());
    await act(async () => {
      await result.current.refreshStock();
    });
    expect(result.current.products).toHaveLength(1);
  });

  it('exposes no needsReproduction', () => {
    const { result } = renderHook(() => useStock());
    expect('needsReproduction' in result.current).toBe(false);
  });
});

describe('useStock - restock', () => {
  it('enqueues a shopify_stock restock op, syncs and refreshes', async () => {
    mockGetCached.mockResolvedValue([makeProduct()]);
    const { result } = renderHook(() => useStock());
    await act(async () => {
      await result.current.restock('V1', 3, 'delivery');
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const entry = mockInsert.mock.calls[0][1][0];
    expect(entry.type).toBe('shopify_stock');
    expect(JSON.parse(entry.payload)).toEqual({
      kind: 'restock',
      variantGid: 'V1',
      requested: 3,
      note: 'delivery',
    });
    expect(productsModule.updateLocalStock).toHaveBeenCalledWith(mockDb, 'P1', 'V1', 3);
    expect(mockRequestSync).toHaveBeenCalled();
    expect(mockRefreshCatalogue).toHaveBeenCalled();
  });

  it('does nothing for delta 0', async () => {
    const { result } = renderHook(() => useStock());
    await act(async () => {
      await result.current.restock('V1', 0, '');
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockRequestSync).not.toHaveBeenCalled();
  });
});
