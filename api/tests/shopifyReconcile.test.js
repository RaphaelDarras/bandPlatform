'use strict';

/**
 * Unit tests for the shared-secret-gated Shopify reconcile endpoint (Phase 07-08,
 * SHOP-18/SHOP-19; D-05, T-07-03/T-07-02).
 *
 * The reconcile endpoint is the infrequent backstop that re-asserts Mongo's
 * authoritative absolute stock to Shopify (D-06) and retries any variant left
 * `syncPending` (D-05). Its caller is a scheduled GitHub Actions job with NO JWT,
 * so it is authenticated by a shared-secret header (`X-Reconcile-Secret`) compared
 * with crypto.timingSafeEqual (T-07-03) — never the JWT middleware.
 *
 * shopifyOutbound and the Product model are fully mocked so NO network is hit and
 * no real Shopify env values are required. The reconcile secret is set in the test
 * env so the guard is exercised in both authorized and unauthorized states.
 */

const RECONCILE_SECRET = 'test-reconcile-secret-value';

// Outbound push wrapper mock — isShopifyConfigured gates the no-op path,
// syncInventoryOut is the per-variant push the sweep drives (07-07).
jest.mock('../services/shopifyOutbound', () => ({
  isShopifyConfigured: jest.fn(),
  syncInventoryOut: jest.fn(),
}));

// Product model mock — find({active:true}) bases the sweep; no DB is touched.
const mockProduct = { find: jest.fn() };
jest.mock('../models/Product', () => mockProduct);

const express = require('express');
const request = require('supertest');

const shopifyOutbound = require('../services/shopifyOutbound');
const Product = require('../models/Product');
const shopifyRouter = require('../routes/shopify');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/shopify', shopifyRouter);
  return app;
}

const OLD_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...OLD_ENV, SHOPIFY_RECONCILE_SECRET: RECONCILE_SECRET };
  shopifyOutbound.isShopifyConfigured.mockReturnValue(true);
  shopifyOutbound.syncInventoryOut.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = OLD_ENV;
  jest.restoreAllMocks();
});

describe('POST /api/shopify/reconcile — shared-secret guard (T-07-03)', () => {
  it('returns 401 and does zero work when the secret header is missing', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/shopify/reconcile');

    expect(res.status).toBe(401);
    expect(Product.find).not.toHaveBeenCalled();
    expect(shopifyOutbound.syncInventoryOut).not.toHaveBeenCalled();
  });

  it('returns 401 and does zero work when the secret is wrong', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', 'not-the-secret');

    expect(res.status).toBe(401);
    expect(Product.find).not.toHaveBeenCalled();
    expect(shopifyOutbound.syncInventoryOut).not.toHaveBeenCalled();
  });

  it('returns 401 when a length-mismatched secret is supplied (timingSafeEqual length guard)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', 'short');

    expect(res.status).toBe(401);
    expect(shopifyOutbound.syncInventoryOut).not.toHaveBeenCalled();
  });

  it('returns 401 when the reconcile secret is unset server-side (never runs unauthenticated)', async () => {
    delete process.env.SHOPIFY_RECONCILE_SECRET;
    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', RECONCILE_SECRET);

    expect(res.status).toBe(401);
    expect(Product.find).not.toHaveBeenCalled();
    expect(shopifyOutbound.syncInventoryOut).not.toHaveBeenCalled();
  });
});

describe('POST /api/shopify/reconcile — authorized sweep', () => {
  it('pushes each eligible active variant and returns a summary with a timestamp', async () => {
    Product.find.mockResolvedValue([
      {
        _id: 'prod1',
        variants: [
          { sku: 'TEE-S', shopifyInventoryItemId: 'inv-1' }, // eligible: has inv id
          { sku: 'TEE-M', syncPending: true }, // eligible: pending retry
          { sku: 'TEE-L' }, // ineligible: never pushed, not pending
        ],
      },
      {
        _id: 'prod2',
        variants: [
          { sku: 'CD-01', shopifyInventoryItemId: 'inv-2', syncPending: true }, // eligible + pending
        ],
      },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', RECONCILE_SECRET);

    expect(res.status).toBe(200);
    expect(Product.find).toHaveBeenCalledWith({ active: true });

    // Three eligible variants across two products; TEE-L is skipped.
    expect(shopifyOutbound.syncInventoryOut).toHaveBeenCalledTimes(3);
    expect(shopifyOutbound.syncInventoryOut).toHaveBeenCalledWith('prod1', 'TEE-S');
    expect(shopifyOutbound.syncInventoryOut).toHaveBeenCalledWith('prod1', 'TEE-M');
    expect(shopifyOutbound.syncInventoryOut).toHaveBeenCalledWith('prod2', 'CD-01');
    expect(shopifyOutbound.syncInventoryOut).not.toHaveBeenCalledWith('prod1', 'TEE-L');

    expect(res.body.reconciled).toBe(3);
    expect(res.body.syncPendingRetried).toBe(2); // TEE-M + CD-01
    expect(typeof res.body.lastReconcileAt).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.lastReconcileAt))).toBe(false);
  });

  it('skips variants flagged inactive (D-15) even if they carry a Shopify id', async () => {
    Product.find.mockResolvedValue([
      {
        _id: 'prod3',
        variants: [
          { sku: 'OLD-1', shopifyInventoryItemId: 'inv-3', active: false }, // retired variant
          { sku: 'NEW-1', shopifyInventoryItemId: 'inv-4' },
        ],
      },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', RECONCILE_SECRET);

    expect(res.status).toBe(200);
    expect(shopifyOutbound.syncInventoryOut).toHaveBeenCalledTimes(1);
    expect(shopifyOutbound.syncInventoryOut).toHaveBeenCalledWith('prod3', 'NEW-1');
    expect(res.body.reconciled).toBe(1);
  });

  it('returns a no-op 200 when Shopify is unconfigured — no crash, no sweep', async () => {
    shopifyOutbound.isShopifyConfigured.mockReturnValue(false);

    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', RECONCILE_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reconciled: 0, skipped: 'shopify-not-configured' });
    expect(Product.find).not.toHaveBeenCalled();
    expect(shopifyOutbound.syncInventoryOut).not.toHaveBeenCalled();
  });

  it('returns 500 (not a crash) if the sweep read throws', async () => {
    Product.find.mockRejectedValue(new Error('mongo down'));

    const app = buildApp();
    const res = await request(app)
      .post('/api/shopify/reconcile')
      .set('X-Reconcile-Secret', RECONCILE_SECRET);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
