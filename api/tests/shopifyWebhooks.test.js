'use strict';

/**
 * Integration tests for the inbound Shopify webhook router (Phase 07-06,
 * SHOP-18/SHOP-19; D-01/D-04/D-06/D-07/D-08/D-10/D-12/D-13/D-14/D-15).
 *
 * Uses a REAL MongoMemoryServer (not mocked model methods) so the actual
 * D-17 optimistic-lock ($elemMatch on version + versioned $inc) deduct/restock
 * paths and the orderNumber-uniqueness idempotency gate are exercised
 * end-to-end, mirroring webhooks-stripe.test.js. Only the two Shopify service
 * boundaries are mocked: shopifyWebhookAuth (the HMAC gate) and shopifySync
 * (the outbound push fired after each stock mutation) — no live credentials.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');

jest.mock('../services/shopifyWebhookAuth', () => ({
  verifyShopifyWebhook: jest.fn(),
}));

jest.mock('../services/shopifySync', () => ({
  pushInventory: jest.fn().mockResolvedValue({}),
  pushProduct: jest.fn().mockResolvedValue({}),
  archiveProduct: jest.fn().mockResolvedValue({}),
}));

const { verifyShopifyWebhook } = require('../services/shopifyWebhookAuth');
const { pushInventory } = require('../services/shopifySync');

let mongoServer;
let Order;
let Product;
let app;

beforeAll(async () => {
  process.env.SHOPIFY_CLIENT_SECRET = 'test-secret';
  process.env.SHOPIFY_LOCATION_ID = 'gid://shopify/Location/1';

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  Order = require('../models/Order');
  Product = require('../models/Product');

  const shopifyWebhooksRouter = require('../routes/shopifyWebhooks');
  app = express();
  app.use('/api/shopify/webhooks', shopifyWebhooksRouter);
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

// --- payload/product helpers ---------------------------------------------

async function seedProduct({
  name = 'Band T-Shirt',
  basePrice = 20,
  shopifyProductId = 'gid://shopify/Product/999',
  variants = [
    {
      sku: 'S-BLK',
      size: 'S',
      color: 'Black',
      stock: 10,
      version: 0,
      shopifyVariantId: '111',
      shopifyInventoryItemId: 'inv-111',
    },
  ],
} = {}) {
  return Product.create({ name, basePrice, shopifyProductId, variants });
}

function ordersPaidPayload({
  id = 'SHOP-1001',
  variantId = '111',
  sku = 'S-BLK',
  quantity = 2,
  price = '20.00',
  email = 'buyer@example.com',
} = {}) {
  return {
    id,
    email,
    total_price: String(Number(price) * quantity),
    line_items: [
      { variant_id: variantId, sku, quantity, price, title: 'Band T-Shirt' },
    ],
  };
}

function post(path, payload, { hmac = 'valid' } = {}) {
  const body = JSON.stringify(payload);
  const req = request(app).post(path).set('Content-Type', 'application/json');
  if (hmac !== null) req.set('x-shopify-hmac-sha256', hmac);
  return req.send(body);
}

function ordersCancelledPayload({
  id = 'SHOP-1001',
  variantId = '111',
  sku = 'S-BLK',
  quantity = 2,
} = {}) {
  return {
    id,
    line_items: [{ variant_id: variantId, sku, quantity, title: 'Band T-Shirt' }],
  };
}

function refundsCreatePayload({
  id = 'REF-1',
  orderId = 'SHOP-1001',
  variantId = '111',
  sku = 'S-BLK',
  quantity = 3,
} = {}) {
  return {
    id,
    order_id: orderId,
    refund_line_items: [
      { quantity, line_item: { variant_id: variantId, sku } },
    ],
  };
}

// --- Task 1: orders/paid --------------------------------------------------

describe('POST /api/shopify/webhooks/orders-paid', () => {
  it('returns 401 and mutates no Product/Order on an invalid/missing HMAC', async () => {
    verifyShopifyWebhook.mockReturnValue(false);

    const product = await seedProduct();

    const res = await post('/api/shopify/webhooks/orders-paid', ordersPaidPayload(), {
      hmac: 'bad',
    });

    expect(res.status).toBe(401);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(10); // untouched
    expect(await Order.countDocuments()).toBe(0); // no audit created
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it('deducts via the versioned $elemMatch $inc, writes one Order audit, pushes absolute count', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    const product = await seedProduct();

    const res = await post(
      '/api/shopify/webhooks/orders-paid',
      ordersPaidPayload({ id: 'SHOP-1001', quantity: 2 })
    );

    expect(res.status).toBe(200);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(8);
    expect(reloaded.variants[0].version).toBe(1); // version bumped by the deduct

    const order = await Order.findOne({ orderNumber: 'SHOP-1001' });
    expect(order).not.toBeNull();
    expect(order.source).toBe('online');
    expect(order.shippingAddress).toBeUndefined(); // Shopify owns shipping (Pitfall 2)
    expect(order.items).toHaveLength(1);
    expect(order.items[0].variantSku).toBe('S-BLK');
    expect(order.items[0].stockBefore).toBe(10);
    expect(order.items[0].stockAfter).toBe(8);

    // absolute post-deduct count, NOT a delta
    expect(pushInventory).toHaveBeenCalledTimes(1);
    expect(pushInventory).toHaveBeenCalledWith('inv-111', 8);
  });

  it('is idempotent on replay: no double-decrement and no duplicate Order', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    const product = await seedProduct();
    const payload = ordersPaidPayload({ id: 'SHOP-1001', quantity: 2 });

    const res1 = await post('/api/shopify/webhooks/orders-paid', payload);
    expect(res1.status).toBe(200);

    const res2 = await post('/api/shopify/webhooks/orders-paid', payload);
    expect(res2.status).toBe(200);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(8); // not 6 — replay did not double-decrement

    expect(await Order.countDocuments({ orderNumber: 'SHOP-1001' })).toBe(1);
  });

  it('shortfall: insufficient stock leaves stock non-negative and still acks 200', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    const product = await seedProduct({
      variants: [
        {
          sku: 'S-BLK',
          stock: 1, // less than the ordered quantity of 2
          version: 0,
          shopifyVariantId: '111',
          shopifyInventoryItemId: 'inv-111',
        },
      ],
    });

    const res = await post(
      '/api/shopify/webhooks/orders-paid',
      ordersPaidPayload({ id: 'SHOP-1001', quantity: 2 })
    );

    expect(res.status).toBe(200);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(1); // unchanged, NEVER negative

    const order = await Order.findOne({ orderNumber: 'SHOP-1001' });
    expect(order.items[0].stockAfter).toBe(order.items[0].stockBefore);
  });

  it('unknown-SKU payload acks 200 without crashing and creates no stock mutation', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    await seedProduct();

    const res = await post(
      '/api/shopify/webhooks/orders-paid',
      ordersPaidPayload({ id: 'SHOP-1002', variantId: 'nope', sku: 'DOES-NOT-EXIST' })
    );

    expect(res.status).toBe(200);
    expect(pushInventory).not.toHaveBeenCalled();
  });
});

// --- Task 3: products/create|update|delete payload builders --------------

function productCreatePayload({
  id = '5001',
  title = 'New Tee',
  body_html = '<p>desc</p>',
  status = 'active',
  images = [
    { src: 'https://cdn.shopify.com/a.jpg' },
    { src: 'https://cdn.shopify.com/b.jpg' },
  ],
  variants = [
    { id: '900', sku: 'NEW-S', price: '25.00', inventory_item_id: 'inv-900', option1: 'S', option2: 'Black' },
    { id: '901', sku: 'NEW-M', price: '27.00', inventory_item_id: 'inv-901', option1: 'M', option2: 'Black' },
  ],
} = {}) {
  return { id, title, body_html, status, images, variants };
}

// --- Task 2: orders/cancelled + refunds/create restock -------------------

async function paySeededOrder({ quantity = 2 } = {}) {
  verifyShopifyWebhook.mockReturnValue(true);
  const res = await post(
    '/api/shopify/webhooks/orders-paid',
    ordersPaidPayload({ id: 'SHOP-1001', quantity })
  );
  expect(res.status).toBe(200);
  jest.clearAllMocks();
  verifyShopifyWebhook.mockReturnValue(true);
}

describe('POST /api/shopify/webhooks/orders-cancelled', () => {
  it('returns 401 and writes nothing on a bad HMAC', async () => {
    verifyShopifyWebhook.mockReturnValue(false);
    const product = await seedProduct({
      variants: [
        { sku: 'S-BLK', stock: 8, version: 1, shopifyVariantId: '111', shopifyInventoryItemId: 'inv-111' },
      ],
    });
    await Order.create({
      orderNumber: 'SHOP-1001',
      customerEmail: 'buyer@example.com',
      items: [{ productId: product._id, variantSku: 'S-BLK', name: 'Band T-Shirt', quantity: 2, priceAtPurchase: 20, stockBefore: 10, stockAfter: 8 }],
      totalAmount: 40,
      status: 'paid',
      source: 'online',
    });

    const res = await post('/api/shopify/webhooks/orders-cancelled', ordersCancelledPayload(), { hmac: 'bad' });
    expect(res.status).toBe(401);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(8); // untouched
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it('restocks each line item via versioned $inc up and pushes the absolute count', async () => {
    const product = await seedProduct(); // stock 10
    await paySeededOrder({ quantity: 2 }); // -> stock 8, order paid

    const res = await post('/api/shopify/webhooks/orders-cancelled', ordersCancelledPayload({ quantity: 2 }));
    expect(res.status).toBe(200);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(10); // restocked

    const order = await Order.findOne({ orderNumber: 'SHOP-1001' });
    expect(order.status).toBe('failed'); // reversal recorded

    expect(pushInventory).toHaveBeenCalledWith('inv-111', 10);
  });

  it('replay is a safe no-op (no double-restock)', async () => {
    const product = await seedProduct();
    await paySeededOrder({ quantity: 2 });

    const res1 = await post('/api/shopify/webhooks/orders-cancelled', ordersCancelledPayload({ quantity: 2 }));
    expect(res1.status).toBe(200);
    const res2 = await post('/api/shopify/webhooks/orders-cancelled', ordersCancelledPayload({ quantity: 2 }));
    expect(res2.status).toBe(200);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(10); // not 12 — replay did not double-restock
  });
});

describe('POST /api/shopify/webhooks/refunds-create', () => {
  it('returns 401 and writes nothing on a bad HMAC', async () => {
    verifyShopifyWebhook.mockReturnValue(false);
    const product = await seedProduct({
      variants: [
        { sku: 'S-BLK', stock: 7, version: 1, shopifyVariantId: '111', shopifyInventoryItemId: 'inv-111' },
      ],
    });
    await Order.create({
      orderNumber: 'SHOP-1001',
      customerEmail: 'buyer@example.com',
      items: [{ productId: product._id, variantSku: 'S-BLK', name: 'Band T-Shirt', quantity: 3, priceAtPurchase: 20, stockBefore: 10, stockAfter: 7 }],
      totalAmount: 60,
      status: 'paid',
      source: 'online',
    });

    const res = await post('/api/shopify/webhooks/refunds-create', refundsCreatePayload(), { hmac: 'bad' });
    expect(res.status).toBe(401);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(7); // untouched
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it('restocks the refunded quantities and pushes the absolute count', async () => {
    const product = await seedProduct(); // stock 10
    await paySeededOrder({ quantity: 3 }); // -> stock 7, order paid

    const res = await post('/api/shopify/webhooks/refunds-create', refundsCreatePayload({ quantity: 3 }));
    expect(res.status).toBe(200);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.variants[0].stock).toBe(10); // restocked

    expect(pushInventory).toHaveBeenCalledWith('inv-111', 10);
  });
});

// --- Task 3: products/create|update|delete content sync ------------------

describe('POST /api/shopify/webhooks/products-create', () => {
  it('returns 401 and creates no product on a bad HMAC', async () => {
    verifyShopifyWebhook.mockReturnValue(false);

    const res = await post('/api/shopify/webhooks/products-create', productCreatePayload(), { hmac: 'bad' });
    expect(res.status).toBe(401);

    expect(await Product.countDocuments()).toBe(0);
  });

  it('inserts a new Mongo Product capturing all Shopify ids so it is queryable', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    const res = await post('/api/shopify/webhooks/products-create', productCreatePayload());
    expect(res.status).toBe(200);

    const doc = await Product.findOne({ shopifyProductId: 'gid://shopify/Product/5001' });
    expect(doc).not.toBeNull();
    expect(doc.name).toBe('New Tee');
    expect(doc.active).toBe(true);
    expect(doc.images).toEqual(['https://cdn.shopify.com/a.jpg', 'https://cdn.shopify.com/b.jpg']);
    expect(doc.variants).toHaveLength(2);

    const s = doc.variants.find((v) => v.sku === 'NEW-S');
    const m = doc.variants.find((v) => v.sku === 'NEW-M');
    // Inbound ids are normalized to canonical GIDs (webhook payloads carry bare
    // numeric ids; outbound/shopifySync stores + requires GIDs).
    expect(s.shopifyVariantId).toBe('gid://shopify/ProductVariant/900');
    expect(s.shopifyInventoryItemId).toBe('gid://shopify/InventoryItem/inv-900');
    expect(m.shopifyVariantId).toBe('gid://shopify/ProductVariant/901');

    // basePrice = min variant price (25); priceAdjustment splits the rest
    expect(doc.basePrice).toBe(25);
    expect(s.priceAdjustment).toBe(0);
    expect(m.priceAdjustment).toBe(2);
  });
});

describe('POST /api/shopify/webhooks/products-update', () => {
  it('overwrites images and splits price with basePrice frozen (D-12/D-13)', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    await seedProduct({
      name: 'Old Name',
      basePrice: 20,
      shopifyProductId: 'gid://shopify/Product/5001',
      variants: [
        { sku: 'S-BLK', size: 'S', color: 'Black', stock: 10, version: 0, shopifyVariantId: '111', shopifyInventoryItemId: 'inv-111', priceAdjustment: 0 },
      ],
    });

    const payload = {
      id: '5001',
      title: 'Fresh Name',
      body_html: '<p>updated</p>',
      status: 'active',
      images: [{ src: 'https://cdn.shopify.com/new.jpg' }],
      variants: [{ id: '111', sku: 'S-BLK', price: '30.00', inventory_item_id: 'inv-111', option1: 'S', option2: 'Black' }],
    };

    const res = await post('/api/shopify/webhooks/products-update', payload);
    expect(res.status).toBe(200);

    // Regression: a bare-numeric payload id must resolve to the GID-stored
    // product and UPDATE it in place — not insert a duplicate.
    expect(await Product.countDocuments()).toBe(1);

    const doc = await Product.findOne({ shopifyProductId: 'gid://shopify/Product/5001' });
    expect(doc.name).toBe('Fresh Name');
    expect(doc.description).toBe('<p>updated</p>');
    expect(doc.images).toEqual(['https://cdn.shopify.com/new.jpg']); // replaced, order preserved
    expect(doc.basePrice).toBe(20); // frozen
    const v = doc.variants.find((x) => x.sku === 'S-BLK');
    expect(v.priceAdjustment).toBe(10); // 30 - 20
  });

  it('soft-deletes a variant dropped from the payload (D-15): active:false, stock:0', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    await seedProduct({
      basePrice: 20,
      shopifyProductId: 'gid://shopify/Product/5001',
      variants: [
        { sku: 'S-BLK', stock: 5, version: 0, shopifyVariantId: '111', shopifyInventoryItemId: 'inv-111' },
        { sku: 'M-BLK', stock: 7, version: 0, shopifyVariantId: '112', shopifyInventoryItemId: 'inv-112' },
      ],
    });

    const payload = {
      id: '5001',
      title: 'Band Tee',
      status: 'active',
      images: [],
      variants: [{ id: '111', sku: 'S-BLK', price: '20.00', inventory_item_id: 'inv-111' }],
    };

    const res = await post('/api/shopify/webhooks/products-update', payload);
    expect(res.status).toBe(200);

    const doc = await Product.findOne({ shopifyProductId: 'gid://shopify/Product/5001' });
    const dropped = doc.variants.find((v) => v.sku === 'M-BLK');
    expect(dropped.active).toBe(false);
    expect(dropped.stock).toBe(0);
    const kept = doc.variants.find((v) => v.sku === 'S-BLK');
    expect(kept.active).toBe(true);
  });
});

describe('POST /api/shopify/webhooks/products-delete', () => {
  it('soft-deletes the product (active:false) without removing the document (D-14)', async () => {
    verifyShopifyWebhook.mockReturnValue(true);

    const product = await seedProduct({ shopifyProductId: 'gid://shopify/Product/5001' });

    const res = await post('/api/shopify/webhooks/products-delete', { id: '5001' });
    expect(res.status).toBe(200);

    const doc = await Product.findById(product._id);
    expect(doc).not.toBeNull(); // never hard-deleted
    expect(doc.active).toBe(false);
  });

  it('returns 401 and mutates nothing on a bad HMAC', async () => {
    verifyShopifyWebhook.mockReturnValue(false);

    const product = await seedProduct({ shopifyProductId: 'gid://shopify/Product/5001' });

    const res = await post('/api/shopify/webhooks/products-delete', { id: '5001' }, { hmac: 'bad' });
    expect(res.status).toBe(401);

    const doc = await Product.findById(product._id);
    expect(doc.active).toBe(true);
  });
});
