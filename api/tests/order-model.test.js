'use strict';

/**
 * Unit tests for Order model extensions (Phase 06-02, D-04).
 * Verifies required shippingAddress subdocument and the toJSON id transform.
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
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Order model - shippingAddress + toJSON transform', () => {
  let Order;

  beforeAll(() => {
    Order = require('../models/Order');
  });

  const validShippingAddress = () => ({
    addressLine1: '12 Rue de la Paix',
    city: 'Paris',
    postalCode: '75002',
    country: 'France',
  });

  const baseOrder = () => ({
    orderNumber: `HRK-${Date.now()}`.slice(0, 10),
    customerEmail: 'buyer@example.com',
    items: [],
    totalAmount: 42,
  });

  it('fails validation when shippingAddress is missing', async () => {
    await expect(Order.create(baseOrder())).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('fails validation when shippingAddress is missing a required field (city)', async () => {
    await expect(
      Order.create({
        ...baseOrder(),
        shippingAddress: {
          addressLine1: '12 Rue de la Paix',
          postalCode: '75002',
          country: 'France',
        },
      })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('saves successfully with a valid shippingAddress', async () => {
    const order = await Order.create({
      ...baseOrder(),
      shippingAddress: validShippingAddress(),
    });
    expect(order.shippingAddress.city).toBe('Paris');
    expect(order.shippingAddress.addressLine2).toBeUndefined();
  });

  it('serializes with `id` (not `_id`/`__v`) via toJSON transform', async () => {
    const order = await Order.create({
      ...baseOrder(),
      shippingAddress: validShippingAddress(),
    });
    const json = order.toJSON();

    expect(json.id).toBe(order._id.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

  it('exposes `id` when serialized through JSON.stringify (res.json path)', async () => {
    const order = await Order.create({
      ...baseOrder(),
      shippingAddress: validShippingAddress(),
    });
    const serialized = JSON.parse(JSON.stringify(order));

    expect(serialized.id).toBe(order._id.toString());
    expect(serialized._id).toBeUndefined();
  });
});
