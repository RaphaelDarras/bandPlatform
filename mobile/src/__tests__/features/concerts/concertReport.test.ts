/**
 * Tests for getConcertReport function.
 * TDD RED phase - written before implementation.
 *
 * Tests: variantBreakdowns, paymentBreakdowns, voided exclusion, multi-currency.
 */

// Mock expo-router (needed for test environment)
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock api/concerts so we don't need the full HTTP layer
jest.mock('@/api/concerts', () => ({
  apiGetConcerts: jest.fn(() => Promise.resolve([])),
  apiCreateConcert: jest.fn(),
  apiPatchConcert: jest.fn(),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

import { getConcertReport } from '@/features/concerts/useConcerts';
import * as dbModule from '@/db';
import * as salesModule from '@/db/sales';
import * as productsModule from '@/db/products';

// Mock db
const mockDb = {
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  execAsync: jest.fn(() => Promise.resolve()),
};

jest.mock('@/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));

jest.mock('@/db/sales', () => ({
  getLocalSales: jest.fn(),
}));

jest.mock('@/db/products', () => ({
  getCachedProducts: jest.fn(),
}));

const mockGetLocalSales = salesModule.getLocalSales as jest.MockedFunction<typeof salesModule.getLocalSales>;
const mockGetCachedProducts = productsModule.getCachedProducts as jest.MockedFunction<typeof productsModule.getCachedProducts>;

// Helper to build a LocalSaleRow
function buildSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-1',
    concertId: 'concert-1',
    items_json: JSON.stringify([
      { productId: 'prod-1', variantSku: 'SM', quantity: 2, priceAtSale: 10 },
    ]),
    totalAmount: 20,
    total_amount: 20,
    paymentMethod: 'Cash',
    payment_method: 'Cash',
    currency: 'EUR',
    discount: 0,
    discountType: 'flat',
    voided: 0,
    voided_at: null,
    synced: 1,
    created_at: Date.now(),
    ...overrides,
  };
}

// Helper to build a CachedProduct
function buildProduct(id: string, name: string, variants: Array<{ sku: string; label: string }>) {
  return {
    id,
    name,
    price: 10,
    imageUrl: null,
    active: 1,
    updatedAt: Date.now(),
    variants: variants.map((v) => ({ sku: v.sku, label: v.label, priceAdjustment: 0, stock: 10 })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedProducts.mockResolvedValue([
    buildProduct('prod-1', 'T-Shirt', [
      { sku: 'SM', label: 'Small' },
      { sku: 'LG', label: 'Large' },
    ]),
    buildProduct('prod-2', 'Hat', [
      { sku: 'ONE', label: 'One Size' },
    ]),
  ]);
});

describe('getConcertReport', () => {
  describe('Test 1: Basic breakdown with 2 products, 3 variants, 2 sales', () => {
    it('aggregates variant quantities and revenue correctly', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-1',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'SM', quantity: 2, priceAtSale: 10 },
            { productId: 'prod-2', variantSku: 'ONE', quantity: 1, priceAtSale: 15 },
          ]),
          totalAmount: 35,
          total_amount: 35,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-2',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'SM', quantity: 1, priceAtSale: 10 },
            { productId: 'prod-1', variantSku: 'LG', quantity: 3, priceAtSale: 10 },
          ]),
          totalAmount: 40,
          total_amount: 40,
          paymentMethod: 'Card',
          currency: 'EUR',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');

      // T-Shirt SM: 3 units sold, 30 EUR
      const smBreakdown = report.variantBreakdowns.find(
        (v) => v.productId === 'prod-1' && v.variantSku === 'SM'
      );
      expect(smBreakdown).toBeDefined();
      expect(smBreakdown?.quantitySold).toBe(3);
      expect(smBreakdown?.revenue).toBeCloseTo(30);
      expect(smBreakdown?.productName).toBe('T-Shirt');
      expect(smBreakdown?.variantLabel).toBe('Small');

      // T-Shirt LG: 3 units sold, 30 EUR
      const lgBreakdown = report.variantBreakdowns.find(
        (v) => v.productId === 'prod-1' && v.variantSku === 'LG'
      );
      expect(lgBreakdown).toBeDefined();
      expect(lgBreakdown?.quantitySold).toBe(3);

      // Hat ONE: 1 unit, 15 EUR
      const hatBreakdown = report.variantBreakdowns.find(
        (v) => v.productId === 'prod-2' && v.variantSku === 'ONE'
      );
      expect(hatBreakdown).toBeDefined();
      expect(hatBreakdown?.quantitySold).toBe(1);
      expect(hatBreakdown?.revenue).toBeCloseTo(15);
    });

    it('sorts variantBreakdowns by quantitySold descending', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-1',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'SM', quantity: 5, priceAtSale: 10 },
            { productId: 'prod-2', variantSku: 'ONE', quantity: 1, priceAtSale: 15 },
          ]),
          totalAmount: 65,
          total_amount: 65,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');
      expect(report.variantBreakdowns[0].quantitySold).toBeGreaterThanOrEqual(
        report.variantBreakdowns[report.variantBreakdowns.length - 1].quantitySold
      );
    });

    it('returns correct ConcertTotals fields (transactionCount, itemsSold, revenuesByCurrency)', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-1',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'SM', quantity: 2, priceAtSale: 10 },
          ]),
          totalAmount: 20,
          total_amount: 20,
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-2',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'LG', quantity: 1, priceAtSale: 10 },
          ]),
          totalAmount: 10,
          total_amount: 10,
          currency: 'EUR',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');
      expect(report.transactionCount).toBe(2);
      expect(report.itemsSold).toBe(3);
      expect(report.revenuesByCurrency['EUR']).toBeCloseTo(30);
    });
  });

  describe('Test 2: Voided sales excluded from breakdowns', () => {
    it('excludes voided sales from variantBreakdowns and paymentBreakdowns', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-active',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'SM', quantity: 2, priceAtSale: 10 },
          ]),
          totalAmount: 20,
          total_amount: 20,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-voided',
          items_json: JSON.stringify([
            { productId: 'prod-1', variantSku: 'SM', quantity: 10, priceAtSale: 10 },
          ]),
          totalAmount: 100,
          total_amount: 100,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 1,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');

      const smBreakdown = report.variantBreakdowns.find(
        (v) => v.productId === 'prod-1' && v.variantSku === 'SM'
      );
      expect(smBreakdown?.quantitySold).toBe(2); // not 12
      expect(report.transactionCount).toBe(1);
    });

    it('counts voided sales in voidedCount and voidedRevenue', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({ id: 'sale-active', totalAmount: 20, total_amount: 20, voided: 0 }),
        buildSale({ id: 'sale-voided-1', totalAmount: 50, total_amount: 50, voided: 1 }),
        buildSale({ id: 'sale-voided-2', totalAmount: 30, total_amount: 30, voided: 1 }),
      ] as never);

      const report = await getConcertReport('concert-1');
      expect(report.voidedCount).toBe(2);
      expect(report.voidedRevenue).toBeCloseTo(80);
    });
  });

  describe('Test 3: Empty sales array returns zero counts', () => {
    it('returns empty breakdowns with zero voided counts', async () => {
      mockGetLocalSales.mockResolvedValue([] as never);

      const report = await getConcertReport('concert-1');
      expect(report.variantBreakdowns).toHaveLength(0);
      expect(report.paymentBreakdowns).toHaveLength(0);
      expect(report.voidedCount).toBe(0);
      expect(report.voidedRevenue).toBe(0);
      expect(report.transactionCount).toBe(0);
      expect(report.itemsSold).toBe(0);
      expect(report.revenuesByCurrency).toEqual({});
    });
  });

  describe('Test 4: Multi-currency payment breakdown', () => {
    it('produces separate payment breakdown entries per currency', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-eur',
          totalAmount: 20,
          total_amount: 20,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-cad',
          totalAmount: 30,
          total_amount: 30,
          paymentMethod: 'Cash',
          currency: 'CAD',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');

      const eurCash = report.paymentBreakdowns.find(
        (p) => p.method === 'cash' && p.currency === 'EUR'
      );
      const cadCash = report.paymentBreakdowns.find(
        (p) => p.method === 'cash' && p.currency === 'CAD'
      );

      expect(eurCash).toBeDefined();
      expect(eurCash?.revenue).toBeCloseTo(20);
      expect(eurCash?.transactionCount).toBe(1);

      expect(cadCash).toBeDefined();
      expect(cadCash?.revenue).toBeCloseTo(30);
      expect(cadCash?.transactionCount).toBe(1);
    });
  });

  describe('Test 5: Payment method normalisation', () => {
    it('groups mixed-case payment methods together under lowercase key', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-1',
          totalAmount: 20,
          total_amount: 20,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-2',
          totalAmount: 15,
          total_amount: 15,
          paymentMethod: 'CASH',
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-3',
          totalAmount: 10,
          total_amount: 10,
          paymentMethod: 'cash',
          currency: 'EUR',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');

      const cashBreakdown = report.paymentBreakdowns.filter(
        (p) => p.method === 'cash' && p.currency === 'EUR'
      );
      expect(cashBreakdown).toHaveLength(1);
      expect(cashBreakdown[0].transactionCount).toBe(3);
      expect(cashBreakdown[0].revenue).toBeCloseTo(45);
      expect(cashBreakdown[0].displayLabel).toBe('Cash');
    });

    it('uses PayPal display label for paypal method', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-1',
          totalAmount: 25,
          total_amount: 25,
          paymentMethod: 'PayPal',
          currency: 'EUR',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');
      const paypalBreakdown = report.paymentBreakdowns.find((p) => p.method === 'paypal');
      expect(paypalBreakdown?.displayLabel).toBe('PayPal');
    });

    it('sorts paymentBreakdowns by revenue descending', async () => {
      mockGetLocalSales.mockResolvedValue([
        buildSale({
          id: 'sale-1',
          totalAmount: 10,
          total_amount: 10,
          paymentMethod: 'Cash',
          currency: 'EUR',
          voided: 0,
        }),
        buildSale({
          id: 'sale-2',
          totalAmount: 50,
          total_amount: 50,
          paymentMethod: 'Card',
          currency: 'EUR',
          voided: 0,
        }),
      ] as never);

      const report = await getConcertReport('concert-1');
      const revenues = report.paymentBreakdowns.map((p) => p.revenue);
      for (let i = 0; i < revenues.length - 1; i++) {
        expect(revenues[i]).toBeGreaterThanOrEqual(revenues[i + 1]);
      }
    });
  });
});
