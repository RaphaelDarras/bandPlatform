'use strict';

/**
 * Integration tests for POST /api/webhooks/stripe (Phase 06-06).
 *
 * Uses a REAL MongoMemoryServer (not mocked model methods) so the actual
 * atomic Order.findOneAndUpdate idempotency gate and guarded Product $inc
 * decrement are exercised end-to-end, per RESEARCH.md's guidance that
 * route-mock-style tests can't validate real atomic findOneAndUpdate
 * behavior. Only stripeClient.verifyStripeEvent and email.js are mocked.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');

jest.mock('../services/stripeClient', () => ({
  verifyStripeEvent: jest.fn(),
}));

jest.mock('../services/email', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue({}),
  sendBandNotification: jest.fn().mockResolvedValue({}),
}));

const { verifyStripeEvent } = require('../services/stripeClient');
const { sendOrderConfirmation, sendBandNotification } = require('../services/email');

let mongoServer;
let Order;
let Product;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  Order = require('../models/Order');
  Product = require('../models/Product');

  const webhooksRouter = require('../routes/webhooks');
  app = express();
  app.use('/api/webhooks', webhooksRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  jest.clearAllMocks();
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

function shippingAddress() {
  return { addressLine1: '1 Rue de la Paix', city: 'Paris', postalCode: '75001', country: 'France' };
}

async function createPendingOrder({ orderNumber = 'HRK-TEST01', productId, variantSku = 'S-BLK', quantity = 2 } = {}) {
  return Order.create({
    orderNumber,
    customerEmail: 'buyer@example.com',
    customerName: 'Jane Doe',
    items: [
      {
        productId,
        variantSku,
        quantity,
        priceAtPurchase: 20,
        stockBefore: 10,
        stockAfter: 10,
      },
    ],
    totalAmount: 40,
    shippingAddress: shippingAddress(),
    status: 'pending',
    source: 'online',
    paymentMethod: 'stripe',
  });
}

function stripeCheckoutEvent({ orderNumber, paymentIntentId = 'pi_123' }) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: orderNumber,
        payment_status: 'paid',
        payment_intent: paymentIntentId,
      },
    },
  };
}

describe('POST /api/webhooks/stripe', () => {
  it('returns 400 and mutates no Order/Product on an invalid signature', async () => {
    verifyStripeEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const product = await Product.create({
      name: 'Band T-Shirt',
      basePrice: 20,
      variants: [{ sku: 'S-BLK', stock: 10 }],
    });
    const order = await createPendingOrder({ productId: product._id });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'bad')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ some: 'payload' }));

    expect(res.status).toBe(400);

    const reloadedOrder = await Order.findById(order._id);
    expect(reloadedOrder.status).toBe('pending');
    const reloadedProduct = await Product.findById(product._id);
    expect(reloadedProduct.variants[0].stock).toBe(10);
    expect(sendOrderConfirmation).not.toHaveBeenCalled();
    expect(sendBandNotification).not.toHaveBeenCalled();
  });

  it('flips pending order to paid, decrements stock, and sends both emails once', async () => {
    const product = await Product.create({
      name: 'Band T-Shirt',
      basePrice: 20,
      variants: [{ sku: 'S-BLK', stock: 10 }],
    });
    await createPendingOrder({ productId: product._id, quantity: 2 });

    verifyStripeEvent.mockReturnValue(stripeCheckoutEvent({ orderNumber: 'HRK-TEST01' }));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_1' }));

    expect(res.status).toBe(200);

    const order = await Order.findOne({ orderNumber: 'HRK-TEST01' });
    expect(order.status).toBe('paid');
    expect(order.paymentIntentId).toBe('pi_123');
    expect(order.items[0].stockAfter).toBe(8);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].stock).toBe(8);

    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBandNotification).toHaveBeenCalledTimes(1);
    expect(sendBandNotification).toHaveBeenCalledWith(expect.anything(), { shortfall: false });
  });

  it('is idempotent on replay: does not double-decrement stock or double-send email', async () => {
    const product = await Product.create({
      name: 'Band T-Shirt',
      basePrice: 20,
      variants: [{ sku: 'S-BLK', stock: 10 }],
    });
    await createPendingOrder({ productId: product._id, quantity: 2 });

    verifyStripeEvent.mockReturnValue(stripeCheckoutEvent({ orderNumber: 'HRK-TEST01' }));

    const body = JSON.stringify({ id: 'evt_1' });

    const res1 = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res2.status).toBe(200);

    const order = await Order.findOne({ orderNumber: 'HRK-TEST01' });
    expect(order.status).toBe('paid');

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].stock).toBe(8); // not 6 -- replay did not double-decrement

    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBandNotification).toHaveBeenCalledTimes(1);
  });

  it('oversell: leaves stock unchanged/non-negative, still acks 200, still marks paid, flags shortfall', async () => {
    const product = await Product.create({
      name: 'Band T-Shirt',
      basePrice: 20,
      variants: [{ sku: 'S-BLK', stock: 1 }], // less than the order's quantity of 2
    });
    await createPendingOrder({ productId: product._id, quantity: 2 });

    verifyStripeEvent.mockReturnValue(stripeCheckoutEvent({ orderNumber: 'HRK-TEST01' }));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_1' }));

    expect(res.status).toBe(200);

    const order = await Order.findOne({ orderNumber: 'HRK-TEST01' });
    expect(order.status).toBe('paid'); // still marked paid despite the shortfall
    expect(order.items[0].stockAfter).toBe(order.items[0].stockBefore); // unchanged

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].stock).toBe(1); // unchanged, NEVER negative

    expect(sendBandNotification).toHaveBeenCalledWith(expect.anything(), { shortfall: true });
  });
});
