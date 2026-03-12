'use strict';

/**
 * Unit tests for GET, POST, DELETE /api/products (PUT is tested separately)
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
const mockProductModule = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
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

function buildApp() {
  const app = express();
  app.use(express.json());
  const productsRouter = require('../routes/products');
  app.use('/api/products', productsRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

const sampleProduct = {
  _id: 'prod1',
  name: 'Test Shirt',
  description: 'A shirt',
  basePrice: 25,
  category: 'shirts',
  images: [],
  active: true,
  variants: [
    { sku: 'S-BLK', size: 'S', color: 'Black', stock: 10, version: 0, priceAdjustment: 0 },
  ],
};

describe('GET /api/products', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all active products', async () => {
    mockProductModule.find.mockResolvedValue([sampleProduct]);

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    // Should query with active: true
    expect(mockProductModule.find).toHaveBeenCalledWith({ active: true });
  });

  it('filters by category when query param provided', async () => {
    mockProductModule.find.mockResolvedValue([]);

    const res = await request(app).get('/api/products?category=hats');

    expect(res.status).toBe(200);
    expect(mockProductModule.find).toHaveBeenCalledWith({ active: true, category: 'hats' });
  });
});

describe('GET /api/products/:id', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a product by ID', async () => {
    mockProductModule.findById.mockResolvedValue(sampleProduct);

    const res = await request(app).get('/api/products/prod1');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Shirt');
    expect(mockProductModule.findById).toHaveBeenCalledWith('prod1');
  });

  it('returns 404 for missing product', async () => {
    mockProductModule.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/products/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('POST /api/products', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', AUTH_HEADER)
      .send({ basePrice: 25, variants: [{ sku: 'S-1', size: 'S' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name.*basePrice.*variants/i);
  });

  it('returns 400 when variants is not an array', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Shirt', basePrice: 25, variants: 'not-array' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when variant missing sku', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Shirt', basePrice: 25, variants: [{ size: 'S' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sku/i);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Shirt', basePrice: 25, variants: [{ sku: 'S-1', size: 'S' }] });

    expect(res.status).toBe(401);
  });

  it('creates product with valid data and auth', async () => {
    const created = { ...sampleProduct, _id: 'new1' };
    mockProductModule.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Test Shirt', basePrice: 25, variants: [{ sku: 'S-BLK', size: 'S', color: 'Black' }] });

    expect(res.status).toBe(201);
    expect(mockProductModule.create).toHaveBeenCalled();
    expect(res.body.name).toBe('Test Shirt');
  });
});

describe('DELETE /api/products/:id', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soft deletes (sets active: false) and returns success', async () => {
    mockProductModule.findByIdAndUpdate.mockResolvedValue({ ...sampleProduct, active: false });

    const res = await request(app)
      .delete('/api/products/prod1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);
    expect(mockProductModule.findByIdAndUpdate).toHaveBeenCalledWith(
      'prod1',
      { active: false },
      { new: true }
    );
  });

  it('returns 404 for missing product', async () => {
    mockProductModule.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/products/nonexistent')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
