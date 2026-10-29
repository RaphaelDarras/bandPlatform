import { reconcileActiveProducts, getCachedProducts, updateLocalStock } from '@/db/products';

const mockDb = {
  execAsync: jest.fn(() => Promise.resolve()),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 0, changes: 1 })),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  getAllAsync: jest.fn(() => Promise.resolve([] as any[])),
};

beforeEach(() => {
  jest.clearAllMocks();
});

function updateCalls() {
  return (mockDb.runAsync.mock.calls as any[][]).filter((call) =>
    String(call[0]).includes('UPDATE products SET active = 0')
  );
}

describe('reconcileActiveProducts', () => {
  it('marks inactive exactly the cached products absent from the active set', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);

    await reconcileActiveProducts(mockDb as any, ['p1', 'p3']);

    const calls = updateCalls();
    expect(calls).toHaveLength(1);
    // The UPDATE targets the deactivated product (p2), never the active ones.
    expect(calls[0][1]).toContain('p2');
    const targetedIds = calls.map((c) => c[1][c[1].length - 1]);
    expect(targetedIds).toEqual(['p2']);
    expect(targetedIds).not.toContain('p1');
    expect(targetedIds).not.toContain('p3');
  });

  it('is a no-op when every cached product is still active', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    await reconcileActiveProducts(mockDb as any, ['p1', 'p2']);

    expect(updateCalls()).toHaveLength(0);
  });

  it('deactivates every cached row when the active set is empty (all deactivated server-side)', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    await reconcileActiveProducts(mockDb as any, []);

    expect(updateCalls().map((c) => c[1][c[1].length - 1])).toEqual(['p1', 'p2']);
  });

  it('only inspects rows that are currently active', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await reconcileActiveProducts(mockDb as any, ['p1']);

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT id FROM products WHERE active = 1'
    );
    expect(updateCalls()).toHaveLength(0);
  });

  it('compares ids as strings so numeric/string id mismatches do not cause false prunes', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 123 }]);

    await reconcileActiveProducts(mockDb as any, ['123']);

    expect(updateCalls()).toHaveLength(0);
  });
});

describe('getCachedProducts dedupe', () => {
  it('keeps variants sharing an empty SKU when variantGid differs', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'P1', name: 'Tee', price: 20, image_url: null, active: 1, updated_at: 1,
        variants_json: JSON.stringify([
          { variantGid: 'V1', sku: '', label: 'S', priceAdjustment: 0, stock: 1 },
          { variantGid: 'V2', sku: '', label: 'M', priceAdjustment: 0, stock: 2 },
          { variantGid: 'V2', sku: '', label: 'M', priceAdjustment: 0, stock: 2 },
        ]),
      },
    ]);
    const res = await getCachedProducts(mockDb as any);
    expect(res[0].variants.map((v) => v.variantGid)).toEqual(['V1', 'V2']);
  });
});

describe('updateLocalStock', () => {
  it('clamps at 0 and leaves other variants unchanged', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'P1', name: 'Tee', price: 20, image_url: null, active: 1, updated_at: 1,
      variants_json: JSON.stringify([
        { variantGid: 'V1', sku: 'S', label: 'S', priceAdjustment: 0, stock: 4 },
        { variantGid: 'V2', sku: 'XL', label: 'XL', priceAdjustment: 0, stock: 1 },
      ]),
    } as any);
    await updateLocalStock(mockDb as any, 'P1', 'V2', -5);
    const call = (mockDb.runAsync.mock.calls as any[][]).find((c) =>
      String(c[0]).includes('UPDATE products SET variants_json')
    )!;
    const saved = JSON.parse(call[1][0]);
    expect(saved[0].stock).toBe(4);
    expect(saved[1].stock).toBe(0);
  });
});
