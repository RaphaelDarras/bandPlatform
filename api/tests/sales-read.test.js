'use strict';

/**
 * Tests for PATCH /api/sales/:id/applied and GET /api/sales legacy name resolution (07.1-01).
 */

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue({}),
    Schema: actual.Schema,
    model: jest.fn(),
    Types: actual.Types,
  };
});

const mockSaleModule = {
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
jest.mock('../models/Sale', () => mockSaleModule);

const mockProductModule = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
};
jest.mock('../models/Product', () => mockProductModule);

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'admin1', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

const salesRouter = require('../routes/sales');
const app = express();
app.use(express.json());
app.use('/api/sales', salesRouter);

const AUTH = 'Bearer test-token';

function stubSales(list) {
  mockSaleModule.find.mockReturnValue({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(list) })),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /api/sales/:id/applied', () => {
  it('sets appliedDelta by idempotencyKey and returns 200', async () => {
    mockSaleModule.findOne.mockResolvedValue({ items: [{ quantity: 2 }] });
    mockSaleModule.findOneAndUpdate.mockResolvedValue({ _id: 'x' });
    const res = await request(app)
      .patch('/api/sales/abc/applied')
      .set('Authorization', AUTH)
      .send({ lines: [{ lineIndex: 0, appliedDelta: -1 }] });

    expect(res.status).toBe(200);
    expect(mockSaleModule.findOneAndUpdate).toHaveBeenCalledWith(
      { idempotencyKey: 'sale_create:abc' },
      { $set: { 'items.0.appliedDelta': -1 } },
      { new: true }
    );
  });

  it('returns 404 when the sale is not synced yet', async () => {
    mockSaleModule.findOne.mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/sales/abc/applied')
      .set('Authorization', AUTH)
      .send({ lines: [{ lineIndex: 0, appliedDelta: 0 }] });
    expect(res.status).toBe(404);
  });

  it.each([
    ['empty lines', { lines: [] }],
    ['missing lines', {}],
    ['negative lineIndex', { lines: [{ lineIndex: -1, appliedDelta: -1 }] }],
    ['non-integer lineIndex', { lines: [{ lineIndex: 0.5, appliedDelta: -1 }] }],
    ['lineIndex > 99', { lines: [{ lineIndex: 100, appliedDelta: -1 }] }],
    ['positive appliedDelta', { lines: [{ lineIndex: 0, appliedDelta: 1 }] }],
    ['non-integer appliedDelta', { lines: [{ lineIndex: 0, appliedDelta: -1.5 }] }],
  ])('returns 400 for %s', async (_name, body) => {
    const res = await request(app)
      .patch('/api/sales/abc/applied')
      .set('Authorization', AUTH)
      .send(body);
    expect(res.status).toBe(400);
    expect(mockSaleModule.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/sales/:id/applied bounds (WR-02)', () => {
  it.each([
    ['lineIndex past the last item', { lineIndex: 2, appliedDelta: -1 }],
    ['appliedDelta below -quantity', { lineIndex: 0, appliedDelta: -3 }],
  ])('returns 400 for %s without writing', async (_name, line) => {
    mockSaleModule.findOne.mockResolvedValue({ items: [{ quantity: 2 }, { quantity: 1 }] });
    const res = await request(app)
      .patch('/api/sales/abc/applied')
      .set('Authorization', AUTH)
      .send({ lines: [line] });
    expect(res.status).toBe(400);
    expect(mockSaleModule.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('accepts appliedDelta equal to -quantity on the last line', async () => {
    mockSaleModule.findOne.mockResolvedValue({ items: [{ quantity: 2 }, { quantity: 1 }] });
    mockSaleModule.findOneAndUpdate.mockResolvedValue({ _id: 'x' });
    const res = await request(app)
      .patch('/api/sales/abc/applied')
      .set('Authorization', AUTH)
      .send({ lines: [{ lineIndex: 1, appliedDelta: -1 }] });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/sales legacy enrichment', () => {
  const P1 = '507f1f77bcf86cd799439012';

  it('resolves productName/variantLabel/GIDs from the archive', async () => {
    stubSales([{ items: [{ productId: P1, variantSku: 'TEE-M', quantity: 1, priceAtSale: 20 }] }]);
    mockProductModule.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{
        _id: P1,
        name: 'Tee',
        shopifyProductId: '123',
        variants: [{ sku: 'TEE-M', size: 'M', color: 'Black', shopifyVariantId: 'gid://shopify/ProductVariant/55' }],
      }]),
    });

    const res = await request(app).get('/api/sales').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    const item = res.body[0].items[0];
    expect(item.productName).toBe('Tee');
    expect(item.variantLabel).toBe('M / Black');
    expect(item.productGid).toBe('gid://shopify/Product/123');
    expect(item.variantGid).toBe('gid://shopify/ProductVariant/55');
    expect(mockProductModule.find).toHaveBeenCalledTimes(1);
  });

  it('leaves snapshot lines unchanged and skips the archive lookup', async () => {
    stubSales([{ items: [{ productName: 'Tee', variantLabel: 'M', variantSku: 'T', quantity: 1, priceAtSale: 5 }] }]);

    const res = await request(app).get('/api/sales').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body[0].items[0].productName).toBe('Tee');
    expect(mockProductModule.find).not.toHaveBeenCalled();
  });

  it('returns old lines without a name when the product is missing from the archive', async () => {
    stubSales([{ items: [{ productId: P1, variantSku: 'X', quantity: 1, priceAtSale: 5 }] }]);
    mockProductModule.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const res = await request(app).get('/api/sales').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body[0].items[0].productName).toBeUndefined();
  });

  it('still serves sales when the archive lookup fails', async () => {
    stubSales([{ items: [{ productId: P1, variantSku: 'X', quantity: 1, priceAtSale: 5 }] }]);
    mockProductModule.find.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('boom')) });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await request(app).get('/api/sales').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
