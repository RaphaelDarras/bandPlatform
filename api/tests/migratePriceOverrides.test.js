'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { remapOverrides, toProductGid } = require('../scripts/migratePriceOverridesToShopify');

describe('toProductGid', () => {
  it('keeps GIDs, wraps numerics, nulls empties', () => {
    expect(toProductGid('gid://shopify/Product/5')).toBe('gid://shopify/Product/5');
    expect(toProductGid('5')).toBe('gid://shopify/Product/5');
    expect(toProductGid(undefined)).toBeNull();
  });
});

describe('remapOverrides', () => {
  const OID1 = '64b000000000000000000001';
  it('re-keys via archive shopifyProductId', () => {
    const r = remapOverrides(
      [{ productId: OID1, price: 10 }],
      { [OID1]: { shopifyProductId: 'gid://shopify/Product/5' } }
    );
    expect(r).toEqual({
      overrides: [{ productId: 'gid://shopify/Product/5', price: 10 }],
      changed: 1,
      unmapped: [],
    });
  });

  it('is idempotent on already-GID overrides', () => {
    const r = remapOverrides([{ productId: 'gid://shopify/Product/5', price: 10 }], {});
    expect(r.changed).toBe(0);
    expect(r.unmapped).toEqual([]);
    expect(r.overrides[0].productId).toBe('gid://shopify/Product/5');
  });

  it('keeps unmapped overrides and lists them', () => {
    const r = remapOverrides([{ productId: OID1, price: 10 }], {});
    expect(r.changed).toBe(0);
    expect(r.unmapped).toEqual([OID1]);
    expect(r.overrides[0].productId).toBe(OID1);
  });
});

describe('Concert model GID-keyed overrides', () => {
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('validates and stores a GID productId', async () => {
    const Concert = require('../models/Concert');
    const c = await Concert.create({
      date: new Date(),
      country: 'FR',
      city: 'Paris',
      priceOverrides: [{ productId: 'gid://shopify/Product/5', price: 12 }],
    });
    const found = await Concert.findById(c._id).lean();
    expect(found.priceOverrides[0].productId).toBe('gid://shopify/Product/5');
  });
});
