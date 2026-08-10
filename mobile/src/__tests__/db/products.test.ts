import { reconcileActiveProducts } from '@/db/products';

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
