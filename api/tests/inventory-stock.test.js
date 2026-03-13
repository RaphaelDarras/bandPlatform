'use strict';

/**
 * TDD tests for GET /api/inventory/stock
 * Tests stock summary endpoint returning grandTotal, productCount, and per-product/variant breakdown.
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
const mockProductFind = jest.fn();

const mockProductModule = {
  find: mockProductFind,
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  updateOne: jest.fn(),
};

jest.mock('../models/Product', () => mockProductModule);

// Mock other models used by inventory routes
jest.mock('../models/Order', () => ({
  create: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));
jest.mock('../models/Sale', () => ({
  create: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));
jest.mock('../models/InventoryAdjustment', () => ({
  create: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));

// Mock JWT so authenticateToken passes
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'user1', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

// Sample product data for tests
const mockProducts = [
  {
    _id: 'prod001',
    name: 'Band T-Shirt',
    category: 'shirts',
    variants: [
      { sku: 'SHIRT-S-BLK', size: 'S', color: 'Black', stock: 10 },
      { sku: 'SHIRT-M-BLK', size: 'M', color: 'Black', stock: 5 },
    ],
  },
  {
    _id: 'prod002',
    name: 'Band Hoodie',
    category: 'hoodies',
    variants: [
      { sku: 'HOOD-M-GRY', size: 'M', color: 'Grey', stock: 8 },
    ],
  },
];

function buildApp() {
  const app = express();
  app.use(express.json());
  jest.resetModules();
  const inventoryRouter = require('../routes/inventory');
  app.use('/api/inventory', inventoryRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

describe('GET /api/inventory/stock', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Returns 200 with grandTotal and products array when authenticated
  it('Test 1: returns 200 with grandTotal, productCount, and products array when authenticated', async () => {
    mockProductFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockProducts),
    });

    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('grandTotal');
    expect(res.body).toHaveProperty('productCount');
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  // Test 2: Each product has productId, name, category, productTotal, and variants array
  it('Test 2: each product in response has productId, name, category, productTotal, and variants', async () => {
    mockProductFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockProducts),
    });

    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(2);

    const firstProduct = res.body.products[0];
    expect(firstProduct).toHaveProperty('productId');
    expect(firstProduct).toHaveProperty('name');
    expect(firstProduct).toHaveProperty('category');
    expect(firstProduct).toHaveProperty('productTotal');
    expect(firstProduct).toHaveProperty('variants');
    expect(Array.isArray(firstProduct.variants)).toBe(true);
  });

  // Test 3: Each variant has sku, size, color, stock fields
  it('Test 3: each variant has sku, size, color, and stock fields', async () => {
    mockProductFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockProducts),
    });

    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    const firstVariant = res.body.products[0].variants[0];
    expect(firstVariant).toHaveProperty('sku');
    expect(firstVariant).toHaveProperty('size');
    expect(firstVariant).toHaveProperty('color');
    expect(firstVariant).toHaveProperty('stock');
  });

  // Test 4: grandTotal equals sum of all variant stock values
  it('Test 4: grandTotal equals sum of all variant stock values across all products', async () => {
    mockProductFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockProducts),
    });

    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', AUTH_HEADER);

    // 10 + 5 + 8 = 23
    expect(res.status).toBe(200);
    expect(res.body.grandTotal).toBe(23);
    // productTotal for Band T-Shirt = 10 + 5 = 15
    const shirtProduct = res.body.products.find(p => p.name === 'Band T-Shirt');
    expect(shirtProduct.productTotal).toBe(15);
    // productTotal for Band Hoodie = 8
    const hoodieProduct = res.body.products.find(p => p.name === 'Band Hoodie');
    expect(hoodieProduct.productTotal).toBe(8);
  });

  // Test 5: Inactive products are excluded — Product.find is called with { active: true }
  it('Test 5: only queries active products (active: true filter)', async () => {
    const activeProductsOnly = [mockProducts[0]]; // only one active product returned
    mockProductFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(activeProductsOnly),
    });

    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    // Verify find was called with active: true
    expect(mockProductFind).toHaveBeenCalledWith({ active: true });
    // Only 1 product in response
    expect(res.body.products.length).toBe(1);
  });

  // Test 6: Returns 401 without auth token
  it('Test 6: returns 401 without auth token', async () => {
    const res = await request(app)
      .get('/api/inventory/stock');

    expect(res.status).toBe(401);
  });

  // Test 7: Empty products collection returns grandTotal 0 and empty products array
  it('Test 7: returns grandTotal 0 and empty products array when no active products', async () => {
    mockProductFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.grandTotal).toBe(0);
    expect(res.body.productCount).toBe(0);
    expect(res.body.products).toEqual([]);
  });
});
