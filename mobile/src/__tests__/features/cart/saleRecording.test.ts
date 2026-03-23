/**
 * Tests for useSaleRecording hook.
 * TDD RED phase — written before implementation.
 */
import { act, renderHook } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn()
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
}));

jest.mock('@/db/products', () => ({
  updateLocalStock: jest.fn(() => Promise.resolve()),
}));

const mockRecordSaleLocally = outboxModule.recordSaleLocally as jest.Mock;
const mockUpdateLocalStock = productsModule.updateLocalStock as jest.Mock;
const mockGetDb = dbModule.getDb as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset uuid mock
  const { v4 } = require('uuid');
  (v4 as jest.Mock)
    .mockReturnValueOnce('sale-uuid-1')
    .mockReturnValueOnce('outbox-uuid-1');

  // Set up cart with items
  useCartStore.setState({
    items: [
      {
        productId: 'prod-1',
        variantSku: 'TSHIRT-S',
        productName: 'Band T-Shirt',
        variantLabel: 'S',
        quantity: 2,
        priceAtSale: 25.0,
        originalPrice: 25.0,
      },
      {
        productId: 'prod-2',
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
    const [_db, sale, outboxEntry] = mockRecordSaleLocally.mock.calls[0];

    // Sale data
    expect(sale.id).toBe('sale-uuid-1');
    expect(sale.concertId).toBe('concert-abc');
    expect(sale.currency).toBe('EUR');
    expect(sale.paymentMethod).toBe('Cash');
    expect(sale.items).toHaveLength(2);
    expect(sale.items[0]).toMatchObject({
      productId: 'prod-1',
      variantSku: 'TSHIRT-S',
      quantity: 2,
      priceAtSale: 25.0,
    });

    // Outbox entry
    expect(outboxEntry.type).toBe('sale_create');
    expect(outboxEntry.idempotency_key).toBe('sale_create:sale-uuid-1');
    expect(typeof outboxEntry.payload).toBe('string');
    // payload is JSON-stringified
    const payload = JSON.parse(outboxEntry.payload);
    expect(payload.saleId).toBe('sale-uuid-1');
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
      'prod-1',
      'TSHIRT-S',
      -2 // -quantity
    );
    expect(mockUpdateLocalStock).toHaveBeenCalledWith(
      expect.anything(), // db
      'prod-2',
      'STICKER-1',
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

  it('increments syncStore.pendingCount by 1', async () => {
    const { result } = renderHook(() => useSaleRecording());

    await act(async () => {
      await result.current.recordSale('Cash');
    });

    expect(useSyncStore.getState().pendingCount).toBe(1);
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
