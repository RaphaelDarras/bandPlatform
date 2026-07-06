'use strict';

/**
 * Unit tests for Sale and Admin model extensions (Phase 02-01)
 * Tests verify new fields are accepted and idempotencyKey uniqueness is enforced.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ---- Sale model ----

describe('Sale model - extended fields', () => {
  let Sale;
  let Concert;
  let concertId;

  beforeAll(async () => {
    // Fresh require after in-memory DB is up
    Sale = require('../models/Sale');
    Concert = require('../models/Concert');
    // Create a concert to use as concertId
    const concert = await Concert.create({
      date: new Date('2026-06-01'),
      country: 'Ireland',
      city: 'Dublin',
    });
    concertId = concert._id;
  });

  const baseSale = () => ({
    concertId,
    items: [],
    totalAmount: 50,
  });

  it('saves with paymentMethod etransfer', async () => {
    const sale = await Sale.create({ ...baseSale(), paymentMethod: 'etransfer' });
    expect(sale.paymentMethod).toBe('etransfer');
  });

  it('saves with paymentMethod paypal', async () => {
    const sale = await Sale.create({ ...baseSale(), paymentMethod: 'paypal' });
    expect(sale.paymentMethod).toBe('paypal');
  });

  it('saves with currency GBP (default EUR)', async () => {
    const defaultSale = await Sale.create(baseSale());
    expect(defaultSale.currency).toBe('EUR');

    const gbpSale = await Sale.create({ ...baseSale(), currency: 'GBP' });
    expect(gbpSale.currency).toBe('GBP');
  });

  it('saves with discount and discountType percent', async () => {
    const sale = await Sale.create({ ...baseSale(), discount: 10, discountType: 'percent' });
    expect(sale.discount).toBe(10);
    expect(sale.discountType).toBe('percent');
  });

  it('saves with voidedAt date', async () => {
    const voidDate = new Date('2026-06-02');
    const sale = await Sale.create({ ...baseSale(), voidedAt: voidDate });
    expect(sale.voidedAt).toEqual(voidDate);
  });

  it('saves with idempotencyKey', async () => {
    const sale = await Sale.create({ ...baseSale(), idempotencyKey: 'unique-key-123' });
    expect(sale.idempotencyKey).toBe('unique-key-123');
  });

  it('rejects duplicate idempotencyKey', async () => {
    await Sale.create({ ...baseSale(), idempotencyKey: 'dup-key-456' });
    await expect(
      Sale.create({ ...baseSale(), idempotencyKey: 'dup-key-456' })
    ).rejects.toThrow();
  });

  it('allows multiple sales with no idempotencyKey (sparse index)', async () => {
    const sale1 = await Sale.create(baseSale());
    const sale2 = await Sale.create(baseSale());
    expect(sale1._id).toBeDefined();
    expect(sale2._id).toBeDefined();
  });

  it('remains backward compatible with existing cash/card/other paymentMethod', async () => {
    const cashSale = await Sale.create({ ...baseSale(), paymentMethod: 'cash' });
    const cardSale = await Sale.create({ ...baseSale(), paymentMethod: 'card' });
    const otherSale = await Sale.create({ ...baseSale(), paymentMethod: 'other' });
    expect(cashSale.paymentMethod).toBe('cash');
    expect(cardSale.paymentMethod).toBe('card');
    expect(otherSale.paymentMethod).toBe('other');
  });
});

// ---- Product model ----

describe('Product model - JSON serialization', () => {
  let Product;

  beforeAll(() => {
    Product = require('../models/Product');
  });

  const baseProduct = () => ({
    name: 'Test Shirt',
    basePrice: 25,
    variants: [{ sku: 'S-BLK', size: 'S', color: 'Black', stock: 10 }],
  });

  // Regression (Phase 05 verification): Product.toJSON must expose `id` and hide
  // `_id`/`__v`, mirroring Concert. Without it the shop API returns `_id` only, so
  // every frontend `product.id` is undefined and detail links resolve to /shop/undefined.
  it('serializes with `id` (not `_id`/`__v`) via toJSON transform', async () => {
    const product = await Product.create(baseProduct());
    const json = product.toJSON();

    expect(json.id).toBe(product._id.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

  it('exposes `id` when serialized through res.json (JSON.stringify path)', async () => {
    const product = await Product.create(baseProduct());
    const serialized = JSON.parse(JSON.stringify(product));

    expect(serialized.id).toBe(product._id.toString());
    expect(serialized._id).toBeUndefined();
  });
});

// ---- Admin model ----

describe('Admin model - pinHash field', () => {
  let Admin;

  beforeAll(() => {
    Admin = require('../models/Admin');
  });

  const baseAdmin = () => ({
    username: `admin_${Date.now()}_${Math.random()}`,
    email: `admin_${Date.now()}_${Math.random()}@example.com`,
    password: 'password123',
  });

  it('saves admin without pinHash', async () => {
    const admin = await Admin.create(baseAdmin());
    expect(admin.pinHash).toBeUndefined();
  });

  it('saves admin with pinHash string', async () => {
    const admin = await Admin.create({ ...baseAdmin(), pinHash: '$2b$10$hashedpinvalue' });
    expect(admin.pinHash).toBe('$2b$10$hashedpinvalue');
  });

  it('pinHash is not hashed by pre-save hook (stored as-is)', async () => {
    const rawHash = '$2b$10$explicitlyhashed';
    const admin = await Admin.create({ ...baseAdmin(), pinHash: rawHash });
    // pinHash should be stored verbatim — the route handler does hashing, not the model
    expect(admin.pinHash).toBe(rawHash);
  });
});
