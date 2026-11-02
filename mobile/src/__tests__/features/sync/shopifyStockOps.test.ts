jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: jest.fn(() => `uuid-${++n}`) };
});
jest.mock('@/api/shopify', () => ({
  ...jest.requireActual('@/api/shopify'),
  readVariantLevel: jest.fn(),
  adjustAvailable: jest.fn(),
}));
jest.mock('@/db/outbox', () => ({
  SALE_APPLIED: 'sale_applied',
  getAllPendingOutboxRows: jest.fn(() => Promise.resolve([])),
  incrementAttempt: jest.fn(() => Promise.resolve()),
  insertOutboxEntries: jest.fn(() => Promise.resolve()),
  markOutboxDone: jest.fn(() => Promise.resolve()),
  updateOutboxPayload: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/db/sales', () => ({
  getLocalSaleItems: jest.fn(),
  setSaleLineApplied: jest.fn(() => Promise.resolve()),
}));

import { executeStockOp } from '@/features/sync/shopifyStockOps';
import * as shopify from '@/api/shopify';
import * as outbox from '@/db/outbox';
import * as sales from '@/db/sales';

const readLevel = shopify.readVariantLevel as jest.Mock;
const adjust = shopify.adjustAvailable as jest.Mock;
const updatePayload = outbox.updateOutboxPayload as jest.Mock;
const markDone = outbox.markOutboxDone as jest.Mock;
const incAttempt = outbox.incrementAttempt as jest.Mock;
const insertEntries = outbox.insertOutboxEntries as jest.Mock;
const pendingRows = outbox.getAllPendingOutboxRows as jest.Mock;
const getItems = sales.getLocalSaleItems as jest.Mock;
const setApplied = sales.setSaleLineApplied as jest.Mock;

const db = { execAsync: jest.fn(() => Promise.resolve()) } as any;

function row(payload: object, over: Partial<outbox.OutboxRow> = {}): outbox.OutboxRow {
  return {
    id: 'row1',
    type: 'shopify_stock',
    payload: JSON.stringify(payload),
    idempotency_key: 'k',
    status: 'pending',
    attempt_count: 0,
    next_attempt_at: 0,
    created_at: 1,
    ...over,
  };
}
const deduct = (requested: number, extra: object = {}) => ({
  kind: 'deduct',
  variantGid: 'v1',
  saleId: 's1',
  lineIndex: 0,
  requested,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  readLevel.mockResolvedValue({ inventoryItemId: 'inv1', available: 1 });
  adjust.mockResolvedValue({ ok: true, appliedDelta: -1 });
  pendingRows.mockResolvedValue([]);
});

describe('executeStockOp', () => {
  it('deduct clamps, persists plan before mutating, records applied', async () => {
    const res = await executeStockOp(db, row(deduct(2)));
    expect(res).toBe('done');
    expect(JSON.parse(updatePayload.mock.calls[0][2]).plan).toEqual({
      inventoryItemId: 'inv1',
      changeFrom: 1,
      delta: -1,
      key: 'row1',
    });
    expect(updatePayload.mock.invocationCallOrder[0]).toBeLessThan(adjust.mock.invocationCallOrder[0]);
    expect(adjust).toHaveBeenCalledWith({
      inventoryItemId: 'inv1',
      delta: -1,
      changeFromQuantity: 1,
      referenceDocumentUri: 'gid://band-pos/Sale/s1',
      idempotencyKey: 'row1',
    });
    expect(setApplied).toHaveBeenCalledWith(db, 's1', 0, -1);
    expect(insertEntries.mock.calls[0][1][0].idempotency_key).toBe('sale_applied:row1');
    expect(markDone).toHaveBeenCalledWith(db, 'row1');
  });

  it('deduct with 0 available applies nothing', async () => {
    readLevel.mockResolvedValue({ inventoryItemId: 'inv1', available: 0 });
    expect(await executeStockOp(db, row(deduct(2)))).toBe('done');
    expect(adjust).not.toHaveBeenCalled();
    expect(setApplied).toHaveBeenCalledWith(db, 's1', 0, 0);
    expect(insertEntries).toHaveBeenCalled();
  });

  it('replays an existing plan without reading', async () => {
    const plan = { inventoryItemId: 'invX', changeFrom: 4, delta: -2, key: 'frozen' };
    adjust.mockResolvedValue({ ok: true, appliedDelta: -2 });
    await executeStockOp(db, row(deduct(2, { plan })));
    expect(readLevel).not.toHaveBeenCalled();
    expect(adjust).toHaveBeenCalledWith(
      expect.objectContaining({ inventoryItemId: 'invX', delta: -2, changeFromQuantity: 4, idempotencyKey: 'frozen' })
    );
  });

  it('retryable ShopifyError backs off and keeps plan', async () => {
    adjust.mockRejectedValue(new shopify.ShopifyError('network', 'down', { retryable: true }));
    expect(await executeStockOp(db, row(deduct(1), {}))).toBe('retry');
    expect(incAttempt).toHaveBeenCalledWith(db, 'row1', expect.any(Number));
    expect(updatePayload).toHaveBeenCalledTimes(1); // only the initial plan persist
    expect(markDone).not.toHaveBeenCalled();
  });

  it('stale result replans with a new key', async () => {
    adjust
      .mockResolvedValueOnce({ ok: false, code: 'CHANGE_FROM_QUANTITY_STALE', message: 'x' })
      .mockResolvedValueOnce({ ok: true, appliedDelta: -1 });
    expect(await executeStockOp(db, row(deduct(1)))).toBe('done');
    expect(adjust.mock.calls[0][0].idempotencyKey).toBe('row1');
    expect(adjust.mock.calls[1][0].idempotencyKey).not.toBe('row1');
    expect(readLevel).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 stale results', async () => {
    adjust.mockResolvedValue({ ok: false, code: 'CHANGE_FROM_QUANTITY_STALE', message: 'x' });
    expect(await executeStockOp(db, row(deduct(1)))).toBe('retry');
    expect(adjust).toHaveBeenCalledTimes(3);
    expect(incAttempt).toHaveBeenCalled();
  });

  it('drops when variant is not found', async () => {
    readLevel.mockResolvedValue(null);
    expect(await executeStockOp(db, row(deduct(1)))).toBe('dropped');
    expect(console.warn).toHaveBeenCalled();
    expect(setApplied).toHaveBeenCalledWith(db, 's1', 0, 0);
    expect(insertEntries).toHaveBeenCalled();
    expect(markDone).toHaveBeenCalled();
  });

  it('drops on INVALID_INVENTORY_ITEM', async () => {
    adjust.mockResolvedValue({ ok: false, code: 'INVALID_INVENTORY_ITEM', message: 'x' });
    expect(await executeStockOp(db, row(deduct(1)))).toBe('dropped');
    expect(setApplied).toHaveBeenCalledWith(db, 's1', 0, 0);
    expect(markDone).toHaveBeenCalled();
  });

  it('restore re-adds the applied delta', async () => {
    getItems.mockResolvedValue([{ appliedDelta: -2 }]);
    adjust.mockResolvedValue({ ok: true, appliedDelta: 2 });
    const r = await executeStockOp(db, row({ kind: 'restore', variantGid: 'v1', saleId: 's1', lineIndex: 0, requested: 2 }));
    expect(r).toBe('done');
    expect(adjust).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: 2,
        changeFromQuantity: null,
        referenceDocumentUri: 'gid://band-pos/SaleVoid/s1',
      })
    );
    expect(setApplied).toHaveBeenCalledWith(db, 's1', 0, 0);
  });

  it('restore defers while a deduct for the line is pending', async () => {
    getItems.mockResolvedValue([{}]);
    pendingRows.mockResolvedValue([
      row(deduct(1), { id: 'dedRow' }),
    ]);
    const r = await executeStockOp(
      db,
      row({ kind: 'restore', variantGid: 'v1', saleId: 's1', lineIndex: 0, requested: 1 })
    );
    expect(r).toBe('deferred');
    expect(adjust).not.toHaveBeenCalled();
    expect(readLevel).not.toHaveBeenCalled();
    expect(incAttempt).toHaveBeenCalled();
  });

  it('restore with applied 0 makes no Shopify call', async () => {
    getItems.mockResolvedValue([{ appliedDelta: 0 }]);
    const r = await executeStockOp(
      db,
      row({ kind: 'restore', variantGid: 'v1', saleId: 's1', lineIndex: 0, requested: 1 })
    );
    expect(r).toBe('done');
    expect(adjust).not.toHaveBeenCalled();
    expect(readLevel).not.toHaveBeenCalled();
  });

  it('unvoid clamps like deduct', async () => {
    readLevel.mockResolvedValue({ inventoryItemId: 'inv1', available: 2 });
    adjust.mockResolvedValue({ ok: true, appliedDelta: -2 });
    await executeStockOp(db, row({ kind: 'unvoid', variantGid: 'v1', saleId: 's1', lineIndex: 0, requested: 3 }));
    expect(adjust).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -2, referenceDocumentUri: 'gid://band-pos/SaleUnvoid/s1' })
    );
    expect(setApplied).toHaveBeenCalledWith(db, 's1', 0, -2);
  });

  it('positive restock adds stock, no sale write', async () => {
    adjust.mockResolvedValue({ ok: true, appliedDelta: 5 });
    await executeStockOp(db, row({ kind: 'restock', variantGid: 'v1', requested: 5 }));
    expect(adjust).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: 5,
        changeFromQuantity: null,
        referenceDocumentUri: 'gid://band-pos/Restock/row1',
      })
    );
    expect(setApplied).not.toHaveBeenCalled();
    expect(insertEntries).not.toHaveBeenCalled();
  });

  it('negative restock clamps', async () => {
    adjust.mockResolvedValue({ ok: true, appliedDelta: -1 });
    await executeStockOp(db, row({ kind: 'restock', variantGid: 'v1', requested: -4 }));
    expect(adjust).toHaveBeenCalledWith(expect.objectContaining({ delta: -1, changeFromQuantity: 1 }));
  });

  it('IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED keeps delta, rotates key', async () => {
    adjust.mockResolvedValue({ ok: false, code: 'IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED', message: 'x' });
    expect(await executeStockOp(db, row(deduct(1)))).toBe('retry');
    const last = JSON.parse(updatePayload.mock.calls.at(-1)![2]).plan;
    expect(last.delta).toBe(-1);
    expect(last.changeFrom).toBe(1);
    expect(last.key).not.toBe('row1');
    expect(incAttempt).toHaveBeenCalled();
  });

  it('unparsable payload is marked done', async () => {
    expect(await executeStockOp(db, row({}, { payload: 'not json' }))).toBe('dropped');
    expect(markDone).toHaveBeenCalled();
  });
});
