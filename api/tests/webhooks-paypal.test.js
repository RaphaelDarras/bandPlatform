'use strict';

/**
 * Integration tests for POST /api/webhooks/paypal (Phase 06-06).
 *
 * Uses a REAL MongoMemoryServer (not mocked model methods), same rationale as
 * webhooks-stripe.test.js -- exercises the actual atomic
 * Order.findOneAndUpdate idempotency gate and guarded Product $inc
 * decrement, shared via fulfillOrder() (no duplicated logic in the PayPal
 * handler). Only paypalClient.verifyPaypalWebhook and email.js are mocked.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');

jest.mock('../services/paypalClient', () => ({
  verifyPaypalWebhook: jest.fn(),
}));

// webhooks.js also requires stripeClient at module load (both handlers live in
// the same router file) -- the real module eagerly instantiates the Stripe SDK
// and throws without STRIPE_SECRET_KEY, so it must be mocked here too even
// though this suite only exercises the PayPal path (mirrors orders.test.js's
// convention of mocking both provider clients regardless of which is tested).
jest.mock('../services/stripeClient', () => ({
  verifyStripeEvent: jest.fn(),
}));

jest.mock('../services/email', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue({}),
  sendBandNotification: jest.fn().mockResolvedValue({}),
}));

const { verifyPaypalWebhook } = require('../services/paypalClient');
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

async function createPendingOrder({ orderNumber = 'HRK-PAY01', productId, variantSku = 'S-BLK', quantity = 2 } = {}) {
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
    paymentMethod: 'paypal',
  });
}

function captureCompletedEvent({ orderNumber, captureId = 'CAP123' }) {
  return {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: captureId, custom_id: orderNumber },
  };
}

describe('POST /api/webhooks/paypal', () => {
  it('returns 400 and mutates no Order/Product on an invalid signature', async () => {
    verifyPaypalWebhook.mockResolvedValue(false);

    const product = await Product.create({
      name: 'Band T-Shirt',
      basePrice: 20,
      variants: [{ sku: 'S-BLK', stock: 10 }],
    });
    const order = await createPendingOrder({ productId: product._id });

    const res = await request(app)
      .post('/api/webhooks/paypal')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(captureCompletedEvent({ orderNumber: 'HRK-PAY01' })));

    expect(res.status).toBe(400);

    const reloadedOrder = await Order.findById(order._id);
    expect(reloadedOrder.status).toBe('pending');
    const reloadedProduct = await Product.findById(product._id);
    expect(reloadedProduct.variants[0].stock).toBe(10);
    expect(sendOrderConfirmation).not.toHaveBeenCalled();
    expect(sendBandNotification).not.toHaveBeenCalled();
  });

  it('flips pending order to paid, decrements stock, sends both emails, and is idempotent on replay', async () => {
    const product = await Product.create({
      name: 'Band T-Shirt',
      basePrice: 20,
      variants: [{ sku: 'S-BLK', stock: 10 }],
    });
    await createPendingOrder({ productId: product._id, quantity: 2 });

    verifyPaypalWebhook.mockResolvedValue(true);

    const body = JSON.stringify(captureCompletedEvent({ orderNumber: 'HRK-PAY01' }));

    const res1 = await request(app).post('/api/webhooks/paypal').set('Content-Type', 'application/json').send(body);
    expect(res1.status).toBe(200);

    let order = await Order.findOne({ orderNumber: 'HRK-PAY01' });
    expect(order.status).toBe('paid');
    expect(order.paymentIntentId).toBe('CAP123');
    expect(order.items[0].stockAfter).toBe(8);

    let updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].stock).toBe(8);

    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBandNotification).toHaveBeenCalledTimes(1);
    expect(sendBandNotification).toHaveBeenCalledWith(expect.anything(), { shortfall: false });

    // Replay of the same verified event -- idempotent no-op.
    const res2 = await request(app).post('/api/webhooks/paypal').set('Content-Type', 'application/json').send(body);
    expect(res2.status).toBe(200);

    order = await Order.findOne({ orderNumber: 'HRK-PAY01' });
    expect(order.status).toBe('paid');

    updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variants[0].stock).toBe(8); // unchanged -- not double-decremented

    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBandNotification).toHaveBeenCalledTimes(1);
  });
});
