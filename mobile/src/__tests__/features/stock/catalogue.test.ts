import { computePendingStockDelta, mapCatalogue, refreshCatalogue } from '@/features/stock/catalogue';
import * as shopify from '@/api/shopify';
import * as products from '@/db/products';
import * as outbox from '@/db/outbox';

jest.mock('@/api/shopify', () => ({ fetchCatalogue: jest.fn() }));
jest.mock('@/db/products', () => ({
  upsertProducts: jest.fn(() => Promise.resolve()),
  reconcileActiveProducts: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/db/outbox', () => ({
  SHOPIFY_STOCK: 'shopify_stock',
  getAllPendingOutboxRows: jest.fn(() => Promise.resolve([])),
}));

const cat = [
  {
    productGid: 'P1', name: 'Tee', imageUrl: null,
    variants: [
      { variantGid: 'V1', sku: 'S', label: 'S', price: 20, available: 5 },
      { variantGid: 'V2', sku: 'XL', label: 'XL', price: 22, available: 1 },
    ],
  },
];

const row = (payload: any, type = 'shopify_stock') =>
  ({ id: 'x', type, payload: JSON.stringify(payload) }) as any;

beforeEach(() => jest.clearAllMocks());

describe('mapCatalogue', () => {
  it('maps price, adjustments, stock', () => {
    const [p] = mapCatalogue(cat, new Map());
    expect(p.price).toBe(20);
    expect(p.active).toBe(1);
    expect(p.variants.map((v) => v.priceAdjustment)).toEqual([0, 2]);
    expect(p.variants.map((v) => v.stock)).toEqual([5, 1]);
  });
  it('clamps at 0 with pending deduct', () => {
    const c = [{ ...cat[0], variants: [{ ...cat[0].variants[0], available: 2 }] }];
    const [p] = mapCatalogue(c, new Map([['V1', -3]]));
    expect(p.variants[0].stock).toBe(0);
  });
});

describe('computePendingStockDelta', () => {
  it('computes deltas per kind and ignores others', () => {
    const d = computePendingStockDelta([
      row({ kind: 'deduct', variantGid: 'V1', requested: 2 }),
      row({ kind: 'deduct', variantGid: 'A', requested: 2, plan: { delta: -1 } }),
      row({ kind: 'restock', variantGid: 'B', requested: 3 }),
      row({ kind: 'restock', variantGid: 'C', requested: -2 }),
      row({ kind: 'restore', variantGid: 'D', requested: 1 }),
      row({ kind: 'deduct', variantGid: 'E', requested: 9 }, 'sale_applied'),
    ]);
    expect(d.get('V1')).toBe(-2);
    expect(d.get('A')).toBe(-1);
    expect(d.get('B')).toBe(3);
    expect(d.get('C')).toBe(-2);
    expect(d.get('D')).toBe(1);
    expect(d.has('E')).toBe(false);
  });
});

describe('refreshCatalogue', () => {
  it('upserts then reconciles on success', async () => {
    (shopify.fetchCatalogue as jest.Mock).mockResolvedValue(cat);
    expect(await refreshCatalogue({} as any)).toBe(true);
    expect(products.upsertProducts).toHaveBeenCalled();
    expect(products.reconcileActiveProducts).toHaveBeenCalledWith({}, ['P1']);
    expect(outbox.getAllPendingOutboxRows).toHaveBeenCalled();
  });
  it('does nothing on failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (shopify.fetchCatalogue as jest.Mock).mockRejectedValue(new Error('boom'));
    expect(await refreshCatalogue({} as any)).toBe(false);
    expect(products.upsertProducts).not.toHaveBeenCalled();
    expect(products.reconcileActiveProducts).not.toHaveBeenCalled();
  });
});

describe('refreshCatalogue single-flight (WR-04)', () => {
  it('concurrent callers share one Shopify fetch; a later call fetches again', async () => {
    let release!: (v: unknown) => void;
    (shopify.fetchCatalogue as jest.Mock).mockReturnValueOnce(new Promise((r) => (release = r)));
    const a = refreshCatalogue({} as any);
    const b = refreshCatalogue({} as any);
    expect(b).toBe(a);
    release(cat);
    expect(await Promise.all([a, b])).toEqual([true, true]);
    expect(shopify.fetchCatalogue).toHaveBeenCalledTimes(1);

    (shopify.fetchCatalogue as jest.Mock).mockResolvedValueOnce(cat);
    expect(await refreshCatalogue({} as any)).toBe(true);
    expect(shopify.fetchCatalogue).toHaveBeenCalledTimes(2);
  });
});
