'use strict';

/**
 * Unit tests for /api/inventory endpoints:
 * POST /deduct, POST /restock, POST /reserve, POST /release, GET /audit
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

// Mock all models used in inventory routes
const mockProductModule = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
jest.mock('../models/Product', () => mockProductModule);

const mockOrderModule = {
  create: jest.fn(),
  aggregate: jest.fn(),
};
jest.mock('../models/Order', () => mockOrderModule);

const mockSaleModule = {
  create: jest.fn(),
  aggregate: jest.fn(),
};
jest.mock('../models/Sale', () => mockSaleModule);

const mockInventoryAdjustmentModule = {
  create: jest.fn(),
  aggregate: jest.fn(),
};
jest.mock('../models/InventoryAdjustment', () => mockInventoryAdjustmentModule);

// Mock JWT so authenticateToken passes
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'user1', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  const inventoryRouter = require('../routes/inventory');
  app.use('/api/inventory', inventoryRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

// Helper to build a product mock with a variant
function mockProductWith(stock, version) {
  return {
    _id: 'prod1',
    variants: [
      { sku: 'S-BLK', size: 'S', color: 'Black', stock, version, priceAdjustment: 0 },
    ],
  };
}

function updatedProductWith(stock, version) {
  return {
    _id: 'prod1',
    variants: [
      { sku: 'S-BLK', size: 'S', color: 'Black', stock, version, priceAdjustment: 0 },
    ],
  };
}

// ---- POST /deduct ----

describe('POST /api/inventory/deduct', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validDeductBody = {
    productId: 'prod1',
    variantSku: 'S-BLK',
    quantity: 2,
    source: 'online',
    metadata: { orderId: 'ORD-1', customerEmail: 'a@b.com', priceAtPurchase: 25, totalAmount: 50 },
  };

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send({ productId: 'prod1' }); // missing variantSku, quantity, source, metadata

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for invalid source', async () => {
    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send({ ...validDeductBody, source: 'wholesale' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source must be/i);
  });

  it('returns 404 when product not found', async () => {
    mockProductModule.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send(validDeductBody);

    expect(res.status).toBe(404);
  });

  it('returns 409 for insufficient stock', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(1, 0)); // only 1 in stock, requesting 2

    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send(validDeductBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/insufficient stock/i);
    expect(res.body.available).toBe(1);
  });

  it('returns 409 on version conflict', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(10, 0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(null); // version conflict

    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send(validDeductBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/version mismatch/i);
  });

  it('succeeds and creates Order audit for online source', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(10, 0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(updatedProductWith(8, 1));
    mockOrderModule.create.mockResolvedValue({ _id: 'order1' });

    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send(validDeductBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stockAfter).toBe(8);
    expect(res.body.auditId).toBe('order1');
    expect(mockOrderModule.create).toHaveBeenCalled();
    expect(mockSaleModule.create).not.toHaveBeenCalled();
  });

  it('succeeds and creates Sale audit for pos source', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(10, 0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(updatedProductWith(8, 1));
    mockSaleModule.create.mockResolvedValue({ _id: 'sale1' });

    const posBody = {
      ...validDeductBody,
      source: 'pos',
      metadata: { concertId: 'c1', priceAtPurchase: 25, totalAmount: 50, paymentMethod: 'card' },
    };

    const res = await request(app)
      .post('/api/inventory/deduct')
      .set('Authorization', AUTH_HEADER)
      .send(posBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.auditId).toBe('sale1');
    expect(mockSaleModule.create).toHaveBeenCalled();
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });
});

// ---- POST /restock ----

describe('POST /api/inventory/restock', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validRestockBody = {
    productId: 'prod1',
    variantSku: 'S-BLK',
    quantity: 5,
    reason: 'New shipment',
  };

  it('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', AUTH_HEADER)
      .send({ productId: 'prod1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for non-integer quantity', async () => {
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', AUTH_HEADER)
      .send({ ...validRestockBody, quantity: 2.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive integer/i);
  });

  it('returns 400 for zero quantity', async () => {
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', AUTH_HEADER)
      .send({ ...validRestockBody, quantity: 0 });

    // quantity 0 is falsy, hits the first validation
    expect(res.status).toBe(400);
  });

  it('returns 404 when product not found', async () => {
    mockProductModule.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', AUTH_HEADER)
      .send(validRestockBody);

    expect(res.status).toBe(404);
  });

  it('returns 409 on version conflict', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(10, 0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', AUTH_HEADER)
      .send(validRestockBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/version mismatch/i);
  });

  it('succeeds and creates InventoryAdjustment audit', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(10, 0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(updatedProductWith(15, 1));
    mockInventoryAdjustmentModule.create.mockResolvedValue({ _id: 'adj1' });

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', AUTH_HEADER)
      .send(validRestockBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stockBefore).toBe(10);
    expect(res.body.stockAfter).toBe(15);
    expect(res.body.adjustmentId).toBe('adj1');
    expect(mockInventoryAdjustmentModule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod1',
        variantSku: 'S-BLK',
        type: 'restock',
        quantity: 5,
        stockBefore: 10,
        stockAfter: 15,
      })
    );
  });
});

// ---- POST /reserve ----

describe('POST /api/inventory/reserve', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validReserveBody = {
    productId: 'prod1',
    variantSku: 'S-BLK',
    quantity: 1,
    reservationId: 'res-1',
  };

  it('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/inventory/reserve')
      .set('Authorization', AUTH_HEADER)
      .send({ productId: 'prod1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 404 when product not found', async () => {
    mockProductModule.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/inventory/reserve')
      .set('Authorization', AUTH_HEADER)
      .send(validReserveBody);

    expect(res.status).toBe(404);
  });

  it('returns 409 for insufficient stock', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(0, 0));

    const res = await request(app)
      .post('/api/inventory/reserve')
      .set('Authorization', AUTH_HEADER)
      .send(validReserveBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/insufficient stock/i);
  });

  it('succeeds with reservation details and expiration', async () => {
    mockProductModule.findOne.mockResolvedValue(mockProductWith(10, 0));
    mockProductModule.findOneAndUpdate.mockResolvedValue(updatedProductWith(9, 1));

    const before = Date.now();
    const res = await request(app)
      .post('/api/inventory/reserve')
      .set('Authorization', AUTH_HEADER)
      .send(validReserveBody);

    expect(res.status).toBe(200);
    expect(res.body.reserved).toBe(true);
    expect(res.body.version).toBe(1);
    // expiresAt should be roughly 10 minutes in the future
    expect(res.body.expiresAt).toBeGreaterThanOrEqual(before + 600000 - 5000);
  });
});

// ---- POST /release ----

describe('POST /api/inventory/release', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validReleaseBody = {
    productId: 'prod1',
    variantSku: 'S-BLK',
    quantity: 1,
    currentVersion: 1,
  };

  it('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/inventory/release')
      .set('Authorization', AUTH_HEADER)
      .send({ productId: 'prod1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 409 on version conflict', async () => {
    mockProductModule.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/inventory/release')
      .set('Authorization', AUTH_HEADER)
      .send(validReleaseBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/version mismatch/i);
  });

  it('succeeds and returns updated stock', async () => {
    mockProductModule.findOneAndUpdate.mockResolvedValue(updatedProductWith(11, 2));

    const res = await request(app)
      .post('/api/inventory/release')
      .set('Authorization', AUTH_HEADER)
      .send(validReleaseBody);

    expect(res.status).toBe(200);
    expect(res.body.released).toBe(true);
    expect(res.body.stockAfter).toBe(11);
    expect(res.body.version).toBe(2);
  });
});

// ---- GET /audit ----

describe('GET /api/inventory/audit', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .get('/api/inventory/audit')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/productId.*required/i);
  });

  it('returns combined audit from Orders, Sales, and InventoryAdjustments', async () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    mockOrderModule.aggregate.mockResolvedValue([
      { timestamp: '2025-01-01T00:00:00Z', source: 'online', quantity: 2, variantSku: 'S-BLK' },
    ]);
    mockSaleModule.aggregate.mockResolvedValue([
      { timestamp: '2025-01-02T00:00:00Z', source: 'pos', quantity: 1, variantSku: 'S-BLK' },
    ]);
    mockInventoryAdjustmentModule.aggregate.mockResolvedValue([
      { timestamp: '2025-01-03T00:00:00Z', source: 'restock', quantity: 10, variantSku: 'S-BLK' },
    ]);

    const res = await request(app)
      .get(`/api/inventory/audit?productId=${validObjectId}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    // Should be sorted by timestamp
    expect(res.body[0].source).toBe('online');
    expect(res.body[1].source).toBe('pos');
    expect(res.body[2].source).toBe('restock');
  });
});
