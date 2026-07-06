'use strict';

/**
 * Integration tests for POST /api/orders and POST /api/orders/paypal/capture.
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

// Mock Order model
const mockOrderModule = {
  create: jest.fn(),
};
jest.mock('../models/Order', () => mockOrderModule);

// Mock Product model
const mockProductModule = {
  findById: jest.fn(),
};
jest.mock('../models/Product', () => mockProductModule);

// Mock the Stripe/PayPal service clients
const mockStripeClient = {
  createCheckoutSession: jest.fn(),
};
jest.mock('../services/stripeClient', () => mockStripeClient);

const mockPaypalClient = {
  createPaypalOrder: jest.fn(),
  capturePaypalOrder: jest.fn(),
};
jest.mock('../services/paypalClient', () => mockPaypalClient);

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
  jest.mock('../models/Order', () => mockOrderModule);
  jest.mock('../models/Product', () => mockProductModule);
  jest.mock('../services/stripeClient', () => mockStripeClient);
  jest.mock('../services/paypalClient', () => mockPaypalClient);
  const ordersRouter = require('../routes/orders');
  app.use('/api/orders', ordersRouter);
  return app;
}

function mockProduct(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439012',
    name: 'Band T-Shirt',
    basePrice: 20,
    variants: [{ sku: 'S-BLK', size: 'S', color: 'Black', stock: 10, priceAdjustment: 0 }],
    ...overrides,
  };
}

function mockOrderDoc(overrides = {}) {
  const doc = {
    orderNumber: 'HRK-ABC123',
    customerEmail: 'buyer@example.com',
    items: [],
    totalAmount: 40,
    status: 'pending',
    paymentIntentId: undefined,
    ...overrides,
  };
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
}

function validPayload(overrides = {}) {
  return {
    customerEmail: 'buyer@example.com',
    customerName: 'Jane Doe',
    items: [{ productId: '507f1f77bcf86cd799439012', variantSku: 'S-BLK', quantity: 2 }],
    shippingAddress: {
      addressLine1: '1 Rue de la Paix',
      city: 'Paris',
      postalCode: '75001',
      country: 'France',
    },
    paymentMethod: 'stripe',
    ...overrides,
  };
}

// ---- POST /api/orders ----

describe('POST /api/orders', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a pending order and returns a Stripe redirect URL (no auth required)', async () => {
    mockProductModule.findById.mockResolvedValue(mockProduct());
    mockOrderModule.create.mockResolvedValue(mockOrderDoc());
    mockStripeClient.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session123',
      paymentIntentId: 'pi_123',
    });

    // No Authorization header sent — public route.
    const res = await request(app).post('/api/orders').send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ orderNumber: 'HRK-ABC123', redirectUrl: 'https://checkout.stripe.com/session123' });
    expect(mockStripeClient.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 'HRK-ABC123',
        items: [expect.objectContaining({ name: 'Band T-Shirt', priceAtPurchase: 20, quantity: 2 })],
      })
    );
  });

  it('creates a pending order and returns a PayPal approve URL', async () => {
    mockProductModule.findById.mockResolvedValue(mockProduct());
    mockOrderModule.create.mockResolvedValue(mockOrderDoc());
    mockPaypalClient.createPaypalOrder.mockResolvedValue({
      id: 'PAYPAL123',
      approveUrl: 'https://paypal.com/approve/123',
    });

    const res = await request(app).post('/api/orders').send(validPayload({ paymentMethod: 'paypal' }));

    expect(res.status).toBe(201);
    expect(res.body.redirectUrl).toBe('https://paypal.com/approve/123');
    expect(mockPaypalClient.createPaypalOrder).toHaveBeenCalled();
  });

  it('ignores a tampered client unitPrice and recomputes priceAtPurchase/totalAmount from basePrice + priceAdjustment, leaving stock unchanged', async () => {
    mockProductModule.findById.mockResolvedValue(
      mockProduct({ basePrice: 20, variants: [{ sku: 'S-BLK', stock: 10, priceAdjustment: 5 }] })
    );
    mockOrderModule.create.mockResolvedValue(mockOrderDoc());
    mockStripeClient.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/xyz',
      paymentIntentId: 'pi_1',
    });

    await request(app)
      .post('/api/orders')
      .send(
        validPayload({
          items: [
            { productId: '507f1f77bcf86cd799439012', variantSku: 'S-BLK', quantity: 2, unitPrice: 999999 },
          ],
        })
      );

    expect(mockOrderModule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            priceAtPurchase: 25, // 20 basePrice + 5 priceAdjustment, NOT the tampered 999999
            quantity: 2,
            stockBefore: 10,
            stockAfter: 10, // unchanged — no deduction in this route
          }),
        ],
        totalAmount: 50, // 25 * 2
      })
    );
  });

  it('returns 400 and creates no order when quantity exceeds current variant.stock', async () => {
    mockProductModule.findById.mockResolvedValue(
      mockProduct({ variants: [{ sku: 'S-BLK', stock: 1, priceAdjustment: 0 }] })
    );

    const res = await request(app)
      .post('/api/orders')
      .send(
        validPayload({
          items: [{ productId: '507f1f77bcf86cd799439012', variantSku: 'S-BLK', quantity: 5 }],
        })
      );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 for missing customerEmail', async () => {
    const { customerEmail, ...rest } = validPayload();
    const res = await request(app).post('/api/orders').send(rest);
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 for empty items array', async () => {
    const res = await request(app).post('/api/orders').send(validPayload({ items: [] }));
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 for missing shippingAddress', async () => {
    const { shippingAddress, ...rest } = validPayload();
    const res = await request(app).post('/api/orders').send(rest);
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown productId', async () => {
    mockProductModule.findById.mockResolvedValue(null);
    const res = await request(app).post('/api/orders').send(validPayload());
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown variantSku', async () => {
    mockProductModule.findById.mockResolvedValue(
      mockProduct({ variants: [{ sku: 'OTHER-SKU', stock: 10, priceAdjustment: 0 }] })
    );
    const res = await request(app).post('/api/orders').send(validPayload());
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid paymentMethod', async () => {
    const res = await request(app).post('/api/orders').send(validPayload({ paymentMethod: 'cash' }));
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 when a shippingAddress field exceeds its maxLength bound (V5)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(validPayload({ shippingAddress: { ...validPayload().shippingAddress, country: 'x'.repeat(57) } }));
    expect(res.status).toBe(400);
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns exactly { error: "Internal server error" } on a 500, never leaking error.message', async () => {
    mockProductModule.findById.mockRejectedValue(new Error('DB connection refused: super-secret-detail'));
    const res = await request(app).post('/api/orders').send(validPayload());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

// ---- POST /api/orders/paypal/capture ----

describe('POST /api/orders/paypal/capture', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls capturePaypalOrder and returns { status }', async () => {
    mockPaypalClient.capturePaypalOrder.mockResolvedValue({ status: 'COMPLETED' });

    const res = await request(app).post('/api/orders/paypal/capture').send({ paypalOrderId: 'PAYPAL123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'COMPLETED' });
    expect(mockPaypalClient.capturePaypalOrder).toHaveBeenCalledWith('PAYPAL123');
  });

  it('never touches Product stock or Order creation (side-effect-free beyond the capture call)', async () => {
    mockPaypalClient.capturePaypalOrder.mockResolvedValue({ status: 'COMPLETED' });

    await request(app).post('/api/orders/paypal/capture').send({ paypalOrderId: 'PAYPAL123' });

    expect(mockProductModule.findById).not.toHaveBeenCalled();
    expect(mockOrderModule.create).not.toHaveBeenCalled();
  });

  it('returns 400 when paypalOrderId is missing', async () => {
    const res = await request(app).post('/api/orders/paypal/capture').send({});
    expect(res.status).toBe(400);
    expect(mockPaypalClient.capturePaypalOrder).not.toHaveBeenCalled();
  });

  it('returns a 4xx with { error } on capture failure', async () => {
    mockPaypalClient.capturePaypalOrder.mockRejectedValue(new Error('capture failed'));
    const res = await request(app).post('/api/orders/paypal/capture').send({ paypalOrderId: 'PAYPAL123' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error).toBeDefined();
  });
});
