'use strict';

/**
 * Integration tests for POST /api/inventory/restock/batch.
 *
 * This file deliberately runs against a REAL in-memory MongoDB replica set,
 * NOT the standalone in-memory Mongo server used by models.test.js /
 * order-model.test.js. A standalone mongod cannot run multi-document
 * transactions, and mocked Mongoose cannot model transaction abort — so the
 * D-06 all-or-nothing guarantee can only be proven here.
 *
 * Do NOT mock mongoose or the Product model anywhere in this file.
 */

jest.setTimeout(60000);

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Mock only jsonwebtoken so authenticateToken passes without a real token.
// createdBy is an ObjectId ref, so userId must be a valid ObjectId string.
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: '507f1f77bcf86cd799439011', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const Product = require('../models/Product');
const InventoryAdjustment = require('../models/InventoryAdjustment');

function buildApp() {
  const app = express();
  app.use(express.json());
  const inventoryRouter = require('../routes/inventory');
  app.use('/api/inventory', inventoryRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

async function seedProduct(stocks = [10, 10, 10]) {
  const product = await Product.create({
    name: 'Band T-Shirt',
    basePrice: 25,
    category: 'shirts',
    variants: [
      { sku: 'SHIRT-S-BLK', size: 'S', color: 'Black', stock: stocks[0] },
      { sku: 'SHIRT-M-BLK', size: 'M', color: 'Black', stock: stocks[1] },
      { sku: 'SHIRT-L-BLK', size: 'L', color: 'Black', stock: stocks[2] },
    ],
  });
  return product;
}

describe('POST /api/inventory/restock/batch', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  describe('happy path', () => {
    it('applies all adjustments, writes correct stock and audit records', async () => {
      const product = await seedProduct([10, 10, 10]);

      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 5 },
            { productId: product._id.toString(), variantSku: 'SHIRT-M-BLK', quantity: -3 },
            { productId: product._id.toString(), variantSku: 'SHIRT-L-BLK', quantity: 1 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const reloaded = await Product.findById(product._id);
      const bySku = Object.fromEntries(reloaded.variants.map(v => [v.sku, v.stock]));
      expect(bySku['SHIRT-S-BLK']).toBe(15);
      expect(bySku['SHIRT-M-BLK']).toBe(7);
      expect(bySku['SHIRT-L-BLK']).toBe(11);

      const adjustments = await InventoryAdjustment.find({}).sort({ variantSku: 1 }).lean();
      expect(adjustments).toHaveLength(3);

      const bySkuAdj = Object.fromEntries(adjustments.map(a => [a.variantSku, a]));

      expect(bySkuAdj['SHIRT-S-BLK'].type).toBe('restock');
      expect(bySkuAdj['SHIRT-S-BLK'].quantity).toBe(5);
      expect(bySkuAdj['SHIRT-S-BLK'].stockBefore).toBe(10);
      expect(bySkuAdj['SHIRT-S-BLK'].stockAfter).toBe(15);
      expect(bySkuAdj['SHIRT-S-BLK'].reason).toBeUndefined();

      expect(bySkuAdj['SHIRT-M-BLK'].type).toBe('removal');
      expect(bySkuAdj['SHIRT-M-BLK'].quantity).toBe(-3);
      expect(bySkuAdj['SHIRT-M-BLK'].stockBefore).toBe(10);
      expect(bySkuAdj['SHIRT-M-BLK'].stockAfter).toBe(7);
      expect(bySkuAdj['SHIRT-M-BLK'].reason).toBeUndefined();

      expect(bySkuAdj['SHIRT-L-BLK'].type).toBe('restock');
      expect(bySkuAdj['SHIRT-L-BLK'].quantity).toBe(1);
      expect(bySkuAdj['SHIRT-L-BLK'].stockBefore).toBe(10);
      expect(bySkuAdj['SHIRT-L-BLK'].stockAfter).toBe(11);
      expect(bySkuAdj['SHIRT-L-BLK'].reason).toBeUndefined();
    });
  });

  describe('D-06: mid-batch failure is all-or-nothing', () => {
    it('leaves all variants unchanged and writes zero InventoryAdjustment records when the second adjustment targets a nonexistent variant', async () => {
      const product = await seedProduct([10, 10, 10]);

      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 5 },
            { productId: product._id.toString(), variantSku: 'SHIRT-DOES-NOT-EXIST', quantity: -3 },
            { productId: product._id.toString(), variantSku: 'SHIRT-L-BLK', quantity: 1 },
          ],
        });

      expect(res.status).toBe(409);

      const reloaded = await Product.findById(product._id);
      const bySku = Object.fromEntries(reloaded.variants.map(v => [v.sku, v.stock]));
      expect(bySku['SHIRT-S-BLK']).toBe(10);
      expect(bySku['SHIRT-M-BLK']).toBe(10);
      expect(bySku['SHIRT-L-BLK']).toBe(10);

      const count = await InventoryAdjustment.countDocuments({});
      expect(count).toBe(0);
    });
  });

  describe('D-07: negative stock is allowed', () => {
    it('applies a negative adjustment past zero and records it as a removal', async () => {
      const product = await Product.create({
        name: 'Band Hoodie',
        basePrice: 40,
        category: 'hoodies',
        variants: [{ sku: 'HOOD-M-GRY', size: 'M', color: 'Grey', stock: 2 }],
      });

      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'HOOD-M-GRY', quantity: -5 },
          ],
        });

      expect(res.status).toBe(200);

      const reloaded = await Product.findById(product._id);
      expect(reloaded.variants[0].stock).toBe(-3);

      const adjustment = await InventoryAdjustment.findOne({ variantSku: 'HOOD-M-GRY' }).lean();
      expect(adjustment.type).toBe('removal');
      expect(adjustment.stockBefore).toBe(2);
      expect(adjustment.stockAfter).toBe(-3);
    });
  });

  describe('validation happens before any write', () => {
    it('returns 400 when adjustments is missing / not an array', async () => {
      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/adjustments array is required/i);
    });

    it('returns 400 for an empty adjustments array', async () => {
      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({ adjustments: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/between 1 and 100/i);
    });

    it('returns 400 for a 101-entry adjustments array and leaves seeded stock unchanged', async () => {
      const product = await seedProduct([10, 10, 10]);

      const adjustments = Array.from({ length: 101 }, (_, i) => ({
        productId: product._id.toString(),
        variantSku: `FAKE-SKU-${i}`,
        quantity: 1,
      }));

      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({ adjustments });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/between 1 and 100/i);

      const reloaded = await Product.findById(product._id);
      const bySku = Object.fromEntries(reloaded.variants.map(v => [v.sku, v.stock]));
      expect(bySku['SHIRT-S-BLK']).toBe(10);
      expect(bySku['SHIRT-M-BLK']).toBe(10);
      expect(bySku['SHIRT-L-BLK']).toBe(10);
    });

    it('returns 400 for quantity: 0', async () => {
      const product = await seedProduct();
      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 0 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/non-zero integer/i);
    });

    it('returns 400 for a non-integer quantity', async () => {
      const product = await seedProduct();
      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 2.5 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/non-zero integer/i);
    });

    it('returns 400 for a malformed productId', async () => {
      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: 'not-an-object-id', variantSku: 'SHIRT-S-BLK', quantity: 1 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/productId must be a valid id/i);
    });

    it('returns 400 for a duplicated productId+variantSku pair and leaves seeded stock unchanged', async () => {
      const product = await seedProduct([10, 10, 10]);

      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .set('Authorization', AUTH_HEADER)
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 1 },
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 2 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/duplicate adjustment for variant SHIRT-S-BLK/i);

      const reloaded = await Product.findById(product._id);
      const bySku = Object.fromEntries(reloaded.variants.map(v => [v.sku, v.stock]));
      expect(bySku['SHIRT-S-BLK']).toBe(10);
      expect(bySku['SHIRT-M-BLK']).toBe(10);
      expect(bySku['SHIRT-L-BLK']).toBe(10);
    });
  });

  describe('T-06.1-01: auth is inherited from router.use(authenticateToken)', () => {
    it('returns 401 without an Authorization header', async () => {
      const product = await seedProduct();

      const res = await request(app)
        .post('/api/inventory/restock/batch')
        .send({
          adjustments: [
            { productId: product._id.toString(), variantSku: 'SHIRT-S-BLK', quantity: 1 },
          ],
        });

      expect(res.status).toBe(401);
    });
  });
});
