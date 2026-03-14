'use strict';

/**
 * Integration tests for /api/sales endpoints:
 * POST /api/sales/batch, GET /api/sales, POST /api/sales/:id/void, POST /api/sales/:id/unvoid
 */

// Mock mongoose to avoid real DB connection
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

// Mock Sale model
const mockSaleModule = {
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
};
jest.mock('../models/Sale', () => mockSaleModule);

// Mock Product model
const mockProductModule = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
jest.mock('../models/Product', () => mockProductModule);

// Mock JWT so authenticateToken passes
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'admin1', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  // Clear module cache to get a fresh router each test
  jest.resetModules();
  // Re-apply mocks after reset
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
  jest.mock('../models/Sale', () => mockSaleModule);
  jest.mock('../models/Product', () => mockProductModule);
  jest.mock('jsonwebtoken', () => ({
    verify: jest.fn().mockReturnValue({ userId: 'admin1', role: 'admin' }),
    sign: jest.fn(),
  }));
  const salesRouter = require('../routes/sales');
  app.use('/api/sales', salesRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

// Helper to create a valid sale entry
function makeSaleEntry(overrides = {}) {
  return {
    concertId: '507f1f77bcf86cd799439011',
    items: [
      {
        productId: '507f1f77bcf86cd799439012',
        variantSku: 'S-BLK',
        quantity: 2,
        priceAtSale: 25,
      },
    ],
    totalAmount: 50,
    paymentMethod: 'cash',
    idempotencyKey: `key-${Math.random()}`,
    ...overrides,
  };
}

// Helper to create a mock product with a variant
function mockProduct(stock = 10) {
  return {
    _id: '507f1f77bcf86cd799439012',
    variants: [{ sku: 'S-BLK', size: 'S', color: 'Black', stock }],
  };
}

// Helper to create a mock sale document (with save method)
function mockSaleDoc(overrides = {}) {
  const doc = {
    _id: '507f1f77bcf86cd799439099',
    concertId: '507f1f77bcf86cd799439011',
    items: [
      {
        productId: '507f1f77bcf86cd799439012',
        variantSku: 'S-BLK',
        quantity: 2,
        priceAtSale: 25,
        stockBefore: 10,
        stockAfter: 8,
      },
    ],
    totalAmount: 50,
    paymentMethod: 'cash',
    idempotencyKey: 'key-123',
    voidedAt: undefined,
    voidedBy: undefined,
    createdAt: new Date(),
    ...overrides,
  };
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
}

// ---- POST /api/sales/batch ----

describe('POST /api/sales/batch', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/sales/batch')
      .send({ sales: [makeSaleEntry()] });

    expect(res.status).toBe(401);
  });

  it('returns 400 for empty array', async () => {
    const res = await request(app)
      .post('/api/sales/batch')
      .set('Authorization', AUTH_HEADER)
      .send([]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('returns 400 for non-array body', async () => {
    const res = await request(app)
      .post('/api/sales/batch')
      .set('Authorization', AUTH_HEADER)
      .send({ sales: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('creates 3 sales and returns { created: 3, skipped: 0 }', async () => {
    const sales = [
      makeSaleEntry({ idempotencyKey: 'key-1' }),
      makeSaleEntry({ idempotencyKey: 'key-2' }),
      makeSaleEntry({ idempotencyKey: 'key-3' }),
    ];

    // No duplicates found
    mockSaleModule.findOne.mockResolvedValue(null);
    // Product found with stock
    mockProductModule.findOne.mockResolvedValue(mockProduct(10));
    // Stock deducted
    mockProductModule.findOneAndUpdate.mockResolvedValue(mockProduct(8));
    // Sale created
    mockSaleModule.create.mockResolvedValue(mockSaleDoc());

    const res = await request(app)
      .post('/api/sales/batch')
      .set('Authorization', AUTH_HEADER)
      .send(sales);

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(3);
    expect(res.body.skipped).toBe(0);
    expect(Array.isArray(res.body.sales)).toBe(true);
    expect(res.body.sales).toHaveLength(3);
  });

  it('skips duplicates by idempotencyKey and returns { created: 1, skipped: 2 }', async () => {
    const sales = [
      makeSaleEntry({ idempotencyKey: 'dup-1' }),
      makeSaleEntry({ idempotencyKey: 'dup-2' }),
      makeSaleEntry({ idempotencyKey: 'key-new' }),
    ];

    // First two are duplicates, last is new
    mockSaleModule.findOne
      .mockResolvedValueOnce(mockSaleDoc({ idempotencyKey: 'dup-1' }))
      .mockResolvedValueOnce(mockSaleDoc({ idempotencyKey: 'dup-2' }))
      .mockResolvedValueOnce(null);

    mockProductModule.findOne.mockResolvedValue(mockProduct(10));
    mockProductModule.findOneAndUpdate.mockResolvedValue(mockProduct(8));
    mockSaleModule.create.mockResolvedValue(mockSaleDoc({ idempotencyKey: 'key-new' }));

    const res = await request(app)
      .post('/api/sales/batch')
      .set('Authorization', AUTH_HEADER)
      .send(sales);

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    expect(res.body.skipped).toBe(2);
  });

  it('deducts stock atomically per item', async () => {
    const sales = [makeSaleEntry({ idempotencyKey: 'key-atomic' })];

    mockSaleModule.findOne.mockResolvedValue(null);
    mockProductModule.findOne.mockResolvedValue(mockProduct(10));
    mockProductModule.findOneAndUpdate.mockResolvedValue(mockProduct(8));
    mockSaleModule.create.mockResolvedValue(mockSaleDoc());

    await request(app)
      .post('/api/sales/batch')
      .set('Authorization', AUTH_HEADER)
      .send(sales);

    expect(mockProductModule.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'variants.sku': 'S-BLK' }),
      expect.objectContaining({ $inc: { 'variants.$.stock': -2 } }),
      expect.objectContaining({ new: true })
    );
  });

  it('allows stock to go negative (concert sales never rejected)', async () => {
    const sales = [makeSaleEntry({ idempotencyKey: 'key-negative' })];

    mockSaleModule.findOne.mockResolvedValue(null);
    // Stock is 0 but still allows the sale
    mockProductModule.findOne.mockResolvedValue(mockProduct(0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(mockProduct(-2));
    mockSaleModule.create.mockResolvedValue(mockSaleDoc());

    const res = await request(app)
      .post('/api/sales/batch')
      .set('Authorization', AUTH_HEADER)
      .send(sales);

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
  });
});

// ---- GET /api/sales ----

describe('GET /api/sales', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(401);
  });

  it('returns all sales sorted by createdAt desc', async () => {
    const mockSales = [mockSaleDoc(), mockSaleDoc()];
    const sortMock = jest.fn().mockResolvedValue(mockSales);
    mockSaleModule.find.mockReturnValue({ sort: sortMock });

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(mockSaleModule.find).toHaveBeenCalledWith({});
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('filters by concertId when provided', async () => {
    const concertId = '507f1f77bcf86cd799439011';
    const mockSales = [mockSaleDoc()];
    const sortMock = jest.fn().mockResolvedValue(mockSales);
    mockSaleModule.find.mockReturnValue({ sort: sortMock });

    const res = await request(app)
      .get(`/api/sales?concertId=${concertId}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(mockSaleModule.find).toHaveBeenCalledWith({ concertId });
    expect(res.body).toHaveLength(1);
  });

  it('includes voided status in response', async () => {
    const voidedSale = mockSaleDoc({ voidedAt: new Date(), voidedBy: 'admin1' });
    const sortMock = jest.fn().mockResolvedValue([voidedSale]);
    mockSaleModule.find.mockReturnValue({ sort: sortMock });

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body[0].voidedAt).toBeTruthy();
  });
});

// ---- POST /api/sales/:id/void ----

describe('POST /api/sales/:id/void', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/sales/507f1f77bcf86cd799439099/void');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown sale id', async () => {
    mockSaleModule.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sales/507f1f77bcf86cd799439099/void')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 400 when sale is already voided', async () => {
    const alreadyVoided = mockSaleDoc({ voidedAt: new Date(), voidedBy: 'admin1' });
    mockSaleModule.findById.mockResolvedValue(alreadyVoided);

    const res = await request(app)
      .post('/api/sales/507f1f77bcf86cd799439099/void')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already voided/i);
  });

  it('voids sale, reverses stock, and returns updated sale', async () => {
    const sale = mockSaleDoc();
    mockSaleModule.findById.mockResolvedValue(sale);
    mockProductModule.findOneAndUpdate.mockResolvedValue(mockProduct(12));

    const res = await request(app)
      .post('/api/sales/507f1f77bcf86cd799439099/void')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(sale.voidedAt).toBeTruthy();
    expect(sale.save).toHaveBeenCalled();
    // Stock reversed: +2 (quantity)
    expect(mockProductModule.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'variants.sku': 'S-BLK' }),
      expect.objectContaining({ $inc: { 'variants.$.stock': 2 } })
    );
  });
});

// ---- POST /api/sales/:id/unvoid ----

describe('POST /api/sales/:id/unvoid', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/sales/507f1f77bcf86cd799439099/unvoid');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown sale id', async () => {
    mockSaleModule.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sales/507f1f77bcf86cd799439099/unvoid')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 400 when sale is not voided', async () => {
    const activeSale = mockSaleDoc({ voidedAt: undefined });
    mockSaleModule.findById.mockResolvedValue(activeSale);

    const res = await request(app)
      .post('/api/sales/507f1f77bcf86cd799439099/unvoid')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not voided/i);
  });

  it('unvoids sale, re-deducts stock, and returns updated sale', async () => {
    const voidedSale = mockSaleDoc({ voidedAt: new Date(), voidedBy: 'admin1' });
    mockSaleModule.findById.mockResolvedValue(voidedSale);
    mockProductModule.findOneAndUpdate.mockResolvedValue(mockProduct(8));

    const res = await request(app)
      .post('/api/sales/507f1f77bcf86cd799439099/unvoid')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(voidedSale.voidedAt).toBeUndefined();
    expect(voidedSale.save).toHaveBeenCalled();
    // Stock re-deducted: -2 (quantity)
    expect(mockProductModule.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'variants.sku': 'S-BLK' }),
      expect.objectContaining({ $inc: { 'variants.$.stock': -2 } })
    );
  });
});
