import {
  reconcileSalesFromServer,
  getLocalSaleItems,
  setSaleLineApplied,
} from '@/db/sales';
import type { ApiSale } from '@/api/sales';

function makeDb(opts: { localItems?: unknown[] | null; pending?: unknown[] } = {}) {
  return {
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn((..._args: unknown[]) => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
    getFirstAsync: jest.fn(() =>
      Promise.resolve(
        opts.localItems ? { items_json: JSON.stringify(opts.localItems) } : null
      )
    ),
    getAllAsync: jest.fn((sql: string) => {
      if (sql.includes('SELECT *')) return Promise.resolve(opts.pending ?? []);
      return Promise.resolve([]);
    }),
  };
}

function sale(items: ApiSale['items']): ApiSale {
  return {
    id: 's1',
    concertId: 'c1',
    totalAmount: 10,
    paymentMethod: 'cash',
    currency: 'EUR',
    discount: 0,
    discountType: 'flat',
    voided: false,
    createdAt: '2026-01-01T00:00:00Z',
    items,
  };
}

function writtenItems(db: ReturnType<typeof makeDb>) {
  const call = (db.runAsync.mock.calls as any[][]).find((c) =>
    String(c[0]).includes('INSERT OR REPLACE INTO sales')
  )!;
  return JSON.parse(call[1][2]);
}

const base = { quantity: 1, priceAtSale: 10, variantSku: 'sku' };

describe('reconcileSalesFromServer', () => {
  it('writes snapshot fields', async () => {
    const db = makeDb();
    await reconcileSalesFromServer(db as any, [
      sale([
        {
          ...base,
          productGid: 'gp',
          variantGid: 'gv',
          productName: 'Tee',
          variantLabel: 'M',
          appliedDelta: -1,
          productId: 'old',
        },
      ]),
    ]);
    expect(writtenItems(db)[0]).toMatchObject({
      productGid: 'gp',
      variantGid: 'gv',
      productName: 'Tee',
      variantLabel: 'M',
      variantSku: 'sku',
      quantity: 1,
      priceAtSale: 10,
      appliedDelta: -1,
      productId: 'old',
    });
  });

  it('keeps local appliedDelta when server lacks it', async () => {
    const db = makeDb({ localItems: [{ ...base, appliedDelta: -1 }] });
    await reconcileSalesFromServer(db as any, [sale([{ ...base }])]);
    expect(writtenItems(db)[0].appliedDelta).toBe(-1);
  });

  it('keeps local appliedDelta while stock ops are pending', async () => {
    const db = makeDb({
      localItems: [{ ...base, appliedDelta: -2 }],
      pending: [
        { type: 'shopify_stock', payload: JSON.stringify({ saleId: 's1' }), idempotency_key: 'k' },
      ],
    });
    await reconcileSalesFromServer(db as any, [sale([{ ...base, appliedDelta: 0 }])]);
    expect(writtenItems(db)[0].appliedDelta).toBe(-2);
  });

  it('server wins with no pending ops', async () => {
    const db = makeDb({ localItems: [{ ...base, appliedDelta: -2 }] });
    await reconcileSalesFromServer(db as any, [sale([{ ...base, appliedDelta: -1 }])]);
    expect(writtenItems(db)[0].appliedDelta).toBe(-1);
  });

  it('stores API-resolved names for old-shape items', async () => {
    const db = makeDb();
    await reconcileSalesFromServer(db as any, [
      sale([{ ...base, productId: 'p1', productName: 'Old Tee', variantLabel: 'L' }]),
    ]);
    expect(writtenItems(db)[0]).toMatchObject({
      productId: 'p1',
      productName: 'Old Tee',
      variantLabel: 'L',
    });
  });
});

describe('getLocalSaleItems / setSaleLineApplied', () => {
  it('returns null when sale missing', async () => {
    expect(await getLocalSaleItems(makeDb() as any, 'x')).toBeNull();
  });

  it('returns parsed items', async () => {
    const db = makeDb({ localItems: [{ ...base }] });
    expect(await getLocalSaleItems(db as any, 's1')).toEqual([{ ...base }]);
  });

  it('updates only the target line', async () => {
    const db = makeDb({ localItems: [{ ...base }, { ...base, quantity: 3 }] });
    await setSaleLineApplied(db as any, 's1', 1, -3);
    const [sql, params] = db.runAsync.mock.calls[0] as any[];
    expect(sql).toContain('UPDATE sales SET items_json');
    const items = JSON.parse(params[0]);
    expect(items[0].appliedDelta).toBeUndefined();
    expect(items[1].appliedDelta).toBe(-3);
  });

  it('no-ops when line missing', async () => {
    const db = makeDb({ localItems: [{ ...base }] });
    await setSaleLineApplied(db as any, 's1', 5, -1);
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});

describe('reconcileSalesFromServer keeps local intent while API ops are pending (WR-06)', () => {
  function dbWith(local: object, pending: unknown[]) {
    const db = makeDb({ localItems: [{ ...base }], pending });
    db.getFirstAsync.mockImplementation(() =>
      Promise.resolve({ items_json: JSON.stringify([{ ...base }]), ...local } as any)
    );
    return db;
  }
  function writtenRow(db: ReturnType<typeof makeDb>) {
    const call = (db.runAsync.mock.calls as any[][]).find((c) =>
      String(c[0]).includes('INSERT OR REPLACE INTO sales')
    )!;
    return { concertId: call[1][1], voided: call[1][9], voidedAt: call[1][10] };
  }

  it('keeps the local voided flag while a sale_set_voided op is pending', async () => {
    const db = dbWith({ voided: 1, voided_at: 1234, concert_id: 'c1' }, [
      { type: 'sale_set_voided', payload: JSON.stringify({ saleId: 's1', voided: true }), idempotency_key: 'k' },
    ]);
    await reconcileSalesFromServer(db as any, [sale([{ ...base }])]); // server: not voided
    expect(writtenRow(db)).toMatchObject({ voided: 1, voidedAt: 1234 });
  });

  it('keeps the local concert while a sale_update_concert op is pending', async () => {
    const db = dbWith({ voided: 0, voided_at: null, concert_id: 'c-new' }, [
      { type: 'sale_update_concert', payload: JSON.stringify({ saleId: 's1', concertId: 'c-new' }), idempotency_key: 'k' },
    ]);
    await reconcileSalesFromServer(db as any, [sale([{ ...base }])]); // server: c1
    expect(writtenRow(db).concertId).toBe('c-new');
  });

  it('takes the server state when nothing is pending', async () => {
    const db = dbWith({ voided: 1, voided_at: 1234, concert_id: 'c-old' }, []);
    await reconcileSalesFromServer(db as any, [sale([{ ...base }])]);
    expect(writtenRow(db)).toMatchObject({ concertId: 'c1', voided: 0, voidedAt: null });
  });
});
