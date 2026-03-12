'use strict';

/**
 * TDD tests for PUT /api/products/:id
 * Tests that product-level fields are whitelisted and inventory-managed
 * fields (stock, version) are never modified.
 */

// Mock mongoose to avoid real DB connection
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue({}),
    Schema: actual.Schema,
    model: jest.fn(),
  };
});

// Mock the Product model
const mockProduct = {
  _id: 'prod123',
  name: 'Test Shirt',
  description: 'Original description',
  basePrice: 25.00,
  category: 'shirts',
  images: [],
  active: true,
  variants: [
    { sku: 'S-BLK', size: 'S', color: 'Black', stock: 10, version: 2, priceAdjustment: 0 },
    { sku: 'M-BLK', size: 'M', color: 'Black', stock: 5, version: 1, priceAdjustment: 0 },
  ],
};

const mockProductModule = {
  findByIdAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  findById: jest.fn(),
};

jest.mock('../models/Product', () => mockProductModule);

// Mock JWT so authenticateToken passes
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'user1', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

// Build a minimal test app using the real products router
function buildApp() {
  const app = express();
  app.use(express.json());
  // Clear module cache so each test file gets a fresh router
  const productsRouter = require('../routes/products');
  app.use('/api/products', productsRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

describe('PUT /api/products/:id — safe field whitelisting', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Return a fresh copy of mockProduct for findById
    mockProductModule.findById.mockResolvedValue({ ...mockProduct, variants: mockProduct.variants.map(v => ({ ...v })) });
    mockProductModule.findByIdAndUpdate.mockResolvedValue({ ...mockProduct });
    mockProductModule.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  beforeAll(() => {
    // Load the app once
    app = buildApp();
  });

  // Test 1: PUT with {name} updates name; stock and version unchanged
  it('Test 1: updates name without touching stock or version', async () => {
    const updatedProduct = { ...mockProduct, name: 'New Name' };
    mockProductModule.findById.mockResolvedValue(updatedProduct);

    const res = await request(app)
      .put('/api/products/prod123')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);

    // findByIdAndUpdate should have been called with $set containing only 'name'
    expect(mockProductModule.findByIdAndUpdate).toHaveBeenCalled();
    const updateArg = mockProductModule.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg.$set).toBeDefined();
    expect(updateArg.$set.name).toBe('New Name');
    // stock and version must NOT appear in the $set
    expect(updateArg.$set.stock).toBeUndefined();
    expect(updateArg.$set.version).toBeUndefined();
    expect(updateArg.$set.variants).toBeUndefined();
  });

  // Test 2: PUT with variants array updates only color for matching SKU; stock and version unchanged
  it('Test 2: updates variant color by SKU without touching stock or version', async () => {
    const res = await request(app)
      .put('/api/products/prod123')
      .set('Authorization', AUTH_HEADER)
      .send({ variants: [{ sku: 'S-BLK', color: 'Red' }] });

    expect(res.status).toBe(200);

    // updateOne should have been called with positional $set for color only
    expect(mockProductModule.updateOne).toHaveBeenCalled();
    const updateOneArg = mockProductModule.updateOne.mock.calls[0][1];
    expect(updateOneArg.$set['variants.$.color']).toBe('Red');
    // stock and version must NOT appear
    expect(updateOneArg.$set['variants.$.stock']).toBeUndefined();
    expect(updateOneArg.$set['variants.$.version']).toBeUndefined();
  });

  // Test 3: PUT with variants containing stock and version has NO effect on those fields
  it('Test 3: silently ignores stock and version in variant updates', async () => {
    const res = await request(app)
      .put('/api/products/prod123')
      .set('Authorization', AUTH_HEADER)
      .send({ variants: [{ sku: 'S-BLK', stock: 999, version: 999 }] });

    expect(res.status).toBe(200);

    if (mockProductModule.updateOne.mock.calls.length > 0) {
      const updateOneArg = mockProductModule.updateOne.mock.calls[0][1];
      expect(updateOneArg.$set['variants.$.stock']).toBeUndefined();
      expect(updateOneArg.$set['variants.$.version']).toBeUndefined();
    }
    // findByIdAndUpdate should NOT have been called with stock/version in $set
    if (mockProductModule.findByIdAndUpdate.mock.calls.length > 0) {
      const updateArg = mockProductModule.findByIdAndUpdate.mock.calls[0][1];
      if (updateArg.$set) {
        expect(updateArg.$set.stock).toBeUndefined();
        expect(updateArg.$set.version).toBeUndefined();
      }
    }
  });

  // Test 4: PUT with basePrice and description updates both fields
  it('Test 4: updates basePrice and description', async () => {
    const updatedProduct = { ...mockProduct, basePrice: 29.99, description: 'Updated' };
    mockProductModule.findById.mockResolvedValue(updatedProduct);

    const res = await request(app)
      .put('/api/products/prod123')
      .set('Authorization', AUTH_HEADER)
      .send({ basePrice: 29.99, description: 'Updated' });

    expect(res.status).toBe(200);

    const updateArg = mockProductModule.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg.$set.basePrice).toBe(29.99);
    expect(updateArg.$set.description).toBe('Updated');
  });

  // Test 5: PUT with unknown fields does NOT add them to the document
  it('Test 5: rejects unknown fields with 400', async () => {
    const res = await request(app)
      .put('/api/products/prod123')
      .set('Authorization', AUTH_HEADER)
      .send({ foo: 'bar' });

    expect(res.status).toBe(400);
    // findByIdAndUpdate should NOT have been called with foo
    if (mockProductModule.findByIdAndUpdate.mock.calls.length > 0) {
      const updateArg = mockProductModule.findByIdAndUpdate.mock.calls[0][1];
      if (updateArg.$set) {
        expect(updateArg.$set.foo).toBeUndefined();
      }
    }
  });

  // Test 6: PUT with variant SKU that does not exist is ignored (no new variant added)
  it('Test 6: ignores variant updates for SKUs that do not exist', async () => {
    const res = await request(app)
      .put('/api/products/prod123')
      .set('Authorization', AUTH_HEADER)
      .send({ variants: [{ sku: 'NONEXISTENT', color: 'Blue' }] });

    expect(res.status).toBe(200);

    // updateOne may be called but with a filter that won't match any document
    // The key assertion: no new variant is added to the product
    if (mockProductModule.updateOne.mock.calls.length > 0) {
      const filterArg = mockProductModule.updateOne.mock.calls[0][0];
      expect(filterArg['variants.sku']).toBe('NONEXISTENT');
      // This is fine — the DB simply won't match anything, no variant is created
    }
  });
});
