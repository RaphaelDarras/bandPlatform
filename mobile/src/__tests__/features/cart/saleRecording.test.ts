/**
 * Tests for useSaleRecording hook.
 * TDD RED phase — written before implementation.
 */
import { act, renderHook } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

// Mock expo-crypto (useSaleRecording generates ids with Crypto.randomUUID)
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn()
    .mockReturnValueOnce('sale-uuid-1')
    .mockReturnValueOnce('outbox-uuid-1'),
}));

import { useSaleRecording } from '@/features/cart/useSaleRecording';
import { useCartStore } from '@/stores/cartStore';
import { useSyncStore } from '@/stores/syncStore';
import * as outboxModule from '@/db/outbox';
import * as productsModule from '@/db/products';
import * as dbModule from '@/db';

// Mock db modules
jest.mock('@/db', () => ({
  getDb: jest.fn(() => Promise.resolve({ _mock: 'db' })),
}));

jest.mock('@/db/outbox', () => ({
  recordSaleLocally: jest.fn(() => Promise.resolve()),
  SHOPIFY_STOCK: 'shopify_stock',
}));

jest.mock('@/features/sync/SyncManager', () => ({
  requestSync: jest.fn(),
}));

jest.mock('@/db/products', () => ({
  updateLocalStock: jest.fn(() => Promise.resolve()),
}));

const mockRecordSaleLocally = outboxModule.recordSaleLocally as jest.Mock;
const mockUpdateLocalStock = productsModule.updateLocalStock as jest.Mock;
const mockGetDb = dbModule.getDb as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset randomUUID mock
  const { randomUUID } = require('expo-crypto');
  (randomUUID as jest.Mock)
    .mockReturnValueOnce('sale-uuid-1')
    .mockReturnValueOnce('outbox-uuid-1');

  // Set up cart with items
  useCartStore.setState({
    items: [
      {
        productGid: 'gid://shopify/Product/1',
        variantGid: 'gid://shopify/ProductVariant/S',
        variantSku: 'TSHIRT-S',
        productName: 'Band T-Shirt',
        variantLabel: 'S',
        quantity: 2,
        priceAtSale: 25.0,
        originalPrice: 25.0,
      },
      {
        productGid: 'gid://shopify/Product/2',
        variantGid: 'gid://shopify/ProductVariant/ST',
        variantSku: 'STICKER-1',
        productName: 'Sticker Pack',
        variantLabel: 'Default',
        quantity: 1,
        priceAtSale: 5.0,
        originalPrice: 5.0,
      },
    ],
    concertId: 'concert-abc',
    currency: 'EUR',
    discount: 0,
    discountType: 'flat',
  });

  // Reset sync store
  useSyncStore.setState({ pendingCount: 0 });
});

describe('useSaleRecording', () => {
  it('calls recordSaleLocally with correct sale and outbox data', async () => {
    const { result } = renderHook(() => useSaleRecording());

    await act(async () => {
      await result.current.recordSale('Cash');
    });

    expect(mockRecordSaleLocally).toHaveBeenCalledTimes(1);
    const [_db, sale, entries] = mockRecordSaleLocally.mock.calls[0];
    const outboxEntry = entries[0];

    // Sale data
    expect(sale.id).toBe('sale-uuid-1');
    expect(sale.concertId).toBe('concert-abc');
    expect(sale.currency).toBe('EUR');
    expect(sale.paymentMethod).toBe('cash');
    expect(sale.items).toHaveLength(2);
    expect(sale.items[0]).toMatchObject({
      productGid: 'gid://shopify/Product/1',
      variantGid: 'gid://shopify/ProductVariant/S',
      productName: 'Band T-Shirt',
      variantLabel: 'S',
      variantSku: 'TSHIRT-S',
      quantity: 2,
      priceAtSale: 25.0,
    });
    expect(sale.items[0]).not.toHaveProperty('productId');

    // One atomic call: sale_create + one deduct per line
    expect(entries).toHaveLength(3);
    expect(entries[1].type).toBe('shopify_stock');
    expect(entries[1].idempotency_key).toBe('shopify_stock:sale-uuid-1:0:deduct');
    expect(entries[2].idempotency_key).toBe('shopify_stock:sale-uuid-1:1:deduct');

    // Outbox entry
    expect(outboxEntry.type).toBe('sale_create');
    expect(outboxEntry.idempotency_key).toBe('sale_create:sale-uuid-1');
    expect(typeof outboxEntry.payload).toBe('string');
    // payload is JSON-stringified
    const payload = JSON.parse(outboxEntry.payload);
    expect(payload.saleId).toBe('sale-uuid-1');
    expect(payload.items[0]).toMatchObject({
      productGid: 'gid://shopify/Product/1',
      variantGid: 'gid://shopify/ProductVariant/S',
      productName: 'Band T-Shirt',
      variantLabel: 'S',
    });
  });

  it('calls updateLocalStock for each cart item', async () => {
    const { result } = renderHook(() => useSaleRecording());

    await act(async () => {
      await result.current.recordSale('Card');
    });

    // 2 items => 2 updateLocalStock calls
    expect(mockUpdateLocalStock).toHaveBeenCalledTimes(2);

    expect(mockUpdateLocalStock).toHaveBeenCalledWith(
      expect.anything(), // db
      'gid://shopify/Product/1',
      'gid://shopify/ProductVariant/S',
      -2 // -quantity
    );
    expect(mockUpdateLocalStock).toHaveBeenCalledWith(
      expect.anything(), // db
      'gid://shopify/Product/2',
      'gid://shopify/ProductVariant/ST',
      -1
    );
  });

  it('clears the cart after recording', async () => {
    const { result } = renderHook(() => useSaleRecording());

    await act(async () => {
      await result.current.recordSale('Cash');
    });

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('increments syncStore.pendingCount by 1 + one per deduct line', async () => {
    const { result } = renderHook(() => useSaleRecording());

    await act(async () => {
      await result.current.recordSale('Cash');
    });

    expect(useSyncStore.getState().pendingCount).toBe(3);
  });

  it('returns the sale ID', async () => {
    const { result } = renderHook(() => useSaleRecording());

    let saleId: string | undefined;
    await act(async () => {
      saleId = await result.current.recordSale('Cash');
    });

    expect(saleId).toBe('sale-uuid-1');
  });
});
