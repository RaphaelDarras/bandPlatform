/**
 * Tests for useStock hook.
 * TDD RED phase - written before implementation.
 *
 * Tests: getStockOverview, needsReproduction, refreshStock, restock.
 */

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useStock } from '@/features/stock/useStock';
import * as productsModule from '@/db/products';
import * as inventoryApiModule from '@/api/inventory';
import * as dbModule from '@/db';

// Mock db
const mockDb = {
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  execAsync: jest.fn(() => Promise.resolve()),
  withTransactionAsync: jest.fn((fn: () => Promise<void>) => fn()),
};

jest.mock('@/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));

jest.mock('@/db/products', () => ({
  getCachedProducts: jest.fn(() => Promise.resolve([])),
  upsertProducts: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/api/inventory', () => ({
  apiGetStock: jest.fn(() => Promise.resolve([])),
  apiRestock: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock syncStore for online status
const mockSyncStore = {
  isOnline: true,
  setIsOnline: jest.fn(),
};
jest.mock('@/stores/syncStore', () => ({
  useSyncStore: jest.fn(() => mockSyncStore),
}));

const mockGetCachedProducts = productsModule.getCachedProducts as jest.Mock;
const mockUpsertProducts = productsModule.upsertProducts as jest.Mock;
const mockApiGetStock = inventoryApiModule.apiGetStock as jest.Mock;
const mockApiRestock = inventoryApiModule.apiRestock as jest.Mock;

// Build a cached product with variants
function makeProduct(overrides: Partial<{
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  active: number;
  updatedAt: number;
  variants: Array<{ sku: string; label: string; priceAdjustment: number; stock: number }>;
}> = {}) {
  return {
    id: 'prod-1',
    name: 'Test T-Shirt',
    price: 25,
    imageUrl: null,
    active: 1,
    updatedAt: Date.now(),
    variants: [
      { sku: 'SKU-S', label: 'Small', priceAdjustment: 0, stock: 5 },
      { sku: 'SKU-M', label: 'Medium', priceAdjustment: 0, stock: 10 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedProducts.mockResolvedValue([]);
  mockUpsertProducts.mockResolvedValue(undefined);
  mockApiGetStock.mockResolvedValue([]);
  mockApiRestock.mockResolvedValue({ success: true });
  mockSyncStore.isOnline = true;
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.withTransactionAsync.mockImplementation((fn: () => Promise<void>) => fn());
});

describe('useStock — getStockOverview', () => {
  it('returns products from local cache with variant stock counts', async () => {
    const product = makeProduct({
      id: 'prod-1',
      name: 'Band T-Shirt',
      variants: [
        { sku: 'SKU-S', label: 'Small', priceAdjustment: 0, stock: 3 },
        { sku: 'SKU-L', label: 'Large', priceAdjustment: 0, stock: 7 },
      ],
    });
    mockGetCachedProducts.mockResolvedValue([product]);

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0].name).toBe('Band T-Shirt');
    expect(result.current.products[0].variants).toHaveLength(2);
    expect(result.current.products[0].variants[0].stock).toBe(3);
    expect(result.current.products[0].variants[1].stock).toBe(7);
  });

  it('starts with empty products list and loading false after mount', async () => {
    const { result } = renderHook(() => useStock());

    // Initial state before any async operations
    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
  });
});

describe('useStock — needsReproduction', () => {
  it('returns only products with at least one variant having stock < 0', async () => {
    const product1 = makeProduct({
      id: 'prod-1',
      name: 'Normal Product',
      variants: [
        { sku: 'SKU-S', label: 'Small', priceAdjustment: 0, stock: 5 },
        { sku: 'SKU-M', label: 'Medium', priceAdjustment: 0, stock: 10 },
      ],
    });
    const product2 = makeProduct({
      id: 'prod-2',
      name: 'Deficit Product',
      variants: [
        { sku: 'SKU-S', label: 'Small', priceAdjustment: 0, stock: -2 },
        { sku: 'SKU-M', label: 'Medium', priceAdjustment: 0, stock: 5 },
      ],
    });
    const product3 = makeProduct({
      id: 'prod-3',
      name: 'All Deficit',
      variants: [
        { sku: 'SKU-XL', label: 'XL', priceAdjustment: 0, stock: -1 },
      ],
    });
    mockGetCachedProducts.mockResolvedValue([product1, product2, product3]);

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    expect(result.current.needsReproduction).toHaveLength(2);
    expect(result.current.needsReproduction.map((p) => p.id)).toContain('prod-2');
    expect(result.current.needsReproduction.map((p) => p.id)).toContain('prod-3');
    expect(result.current.needsReproduction.map((p) => p.id)).not.toContain('prod-1');
  });

  it('returns empty array when all variants have non-negative stock', async () => {
    const product = makeProduct({
      variants: [
        { sku: 'SKU-S', label: 'Small', priceAdjustment: 0, stock: 0 }, // 0 is not negative
        { sku: 'SKU-M', label: 'Medium', priceAdjustment: 0, stock: 5 },
      ],
    });
    mockGetCachedProducts.mockResolvedValue([product]);

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    expect(result.current.needsReproduction).toHaveLength(0);
  });
});

describe('useStock — refreshStock', () => {
  it('fetches from API and upserts to local cache when online', async () => {
    const apiProduct = makeProduct({ id: 'prod-1', name: 'API Product' });
    mockApiGetStock.mockResolvedValue([apiProduct]);
    mockGetCachedProducts.mockResolvedValue([apiProduct]);
    mockSyncStore.isOnline = true;

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    expect(mockApiGetStock).toHaveBeenCalled();
    expect(mockUpsertProducts).toHaveBeenCalledWith(mockDb, [apiProduct]);
  });

  it('reads from local cache only when offline (no API call)', async () => {
    const cachedProduct = makeProduct({ id: 'prod-1', name: 'Cached Product' });
    mockGetCachedProducts.mockResolvedValue([cachedProduct]);
    mockSyncStore.isOnline = false;

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    expect(mockApiGetStock).not.toHaveBeenCalled();
    expect(mockGetCachedProducts).toHaveBeenCalled();
    expect(result.current.products[0].name).toBe('Cached Product');
  });
});

describe('useStock — restock', () => {
  it('calls apiRestock with correct parameters', async () => {
    const product = makeProduct({ id: 'prod-1' });
    mockGetCachedProducts.mockResolvedValue([product]);
    mockSyncStore.isOnline = true;

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    await act(async () => {
      await result.current.restock('prod-1', 'SKU-S', 10, 'Concert restock');
    });

    expect(mockApiRestock).toHaveBeenCalledWith('prod-1', 'SKU-S', 10, 'Concert restock');
  });

  it('refreshes local cache after successful restock', async () => {
    const product = makeProduct({ id: 'prod-1' });
    mockGetCachedProducts.mockResolvedValue([product]);
    mockApiGetStock.mockResolvedValue([product]);
    mockSyncStore.isOnline = true;

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await result.current.refreshStock();
    });

    // Clear call count to check refresh is called again
    mockGetCachedProducts.mockClear();
    mockApiGetStock.mockClear();

    await act(async () => {
      await result.current.restock('prod-1', 'SKU-S', 5, '');
    });

    // Should refresh after restock
    expect(mockGetCachedProducts).toHaveBeenCalled();
  });
});
