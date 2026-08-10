'use strict';

/**
 * Unit tests for the outbound Shopify push orchestration wrapper (Phase 07-07,
 * SHOP-18; D-01/D-04/D-05/D-06/D-08).
 *
 * shopifyOutbound.js is the single best-effort, config-guarded entry point every
 * write path (products.js, inventory.js, sales.js) calls to mirror a Mongo write
 * to Shopify. It:
 *   - no-ops (no shopifySync call, no throw) when Shopify is unconfigured,
 *   - persists the ids returned by pushProduct back onto the Mongo doc (D-08),
 *   - sends the ABSOLUTE post-write count via pushInventory (D-06),
 *   - marks the variant syncPending on an inventory push failure (D-05) and
 *     NEVER throws to its caller (best-effort — T-07-13).
 *
 * shopifySync and the Product model are fully mocked so NO network is hit and no
 * real Shopify env values are required. Env is set/cleared per-test so the
 * config guard is exercised in both states.
 */

jest.mock('../services/shopifySync', () => ({
  pushProduct: jest.fn(),
  archiveProduct: jest.fn(),
  pushInventory: jest.fn(),
}));

// Product model mock — only findOne/updateOne are used by syncInventoryOut.
const mockProduct = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};
jest.mock('../models/Product', () => mockProduct);

const shopifySync = require('../services/shopifySync');
const Product = require('../models/Product');
const {
  isShopifyConfigured,
  syncProductOut,
  archiveProductOut,
  syncInventoryOut,
} = require('../services/shopifyOutbound');

const OLD_ENV = process.env;

function configure() {
  process.env = {
    ...OLD_ENV,
    SHOPIFY_CLIENT_ID: 'test-client-id',
    SHOPIFY_SHOP_DOMAIN: 'test-shop.myshopify.com',
  };
}

function unconfigure() {
  process.env = { ...OLD_ENV };
  delete process.env.SHOPIFY_CLIENT_ID;
  delete process.env.SHOPIFY_SHOP_DOMAIN;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = OLD_ENV;
  jest.restoreAllMocks();
});

describe('isShopifyConfigured — the config guard', () => {
  it('is false when SHOPIFY_CLIENT_ID is unset', () => {
    unconfigure();
    process.env.SHOPIFY_SHOP_DOMAIN = 'test-shop.myshopify.com';
    expect(isShopifyConfigured()).toBe(false);
  });

  it('is false when SHOPIFY_SHOP_DOMAIN is unset', () => {
    unconfigure();
    process.env.SHOPIFY_CLIENT_ID = 'test-client-id';
    expect(isShopifyConfigured()).toBe(false);
  });

  it('is true only when both SHOPIFY_CLIENT_ID and SHOPIFY_SHOP_DOMAIN are present', () => {
    configure();
    expect(isShopifyConfigured()).toBe(true);
  });
});

describe('unconfigured — every push is a no-op that never throws (T-07-13)', () => {
  beforeEach(() => {
    unconfigure();
  });

  it('syncProductOut makes zero shopifySync calls and does not throw', async () => {
    const product = { name: 'Tee', variants: [{ sku: 'TEE-S' }], save: jest.fn() };
    await expect(syncProductOut(product)).resolves.toBeUndefined();
    expect(shopifySync.pushProduct).not.toHaveBeenCalled();
    expect(product.save).not.toHaveBeenCalled();
  });

  it('archiveProductOut makes zero shopifySync calls and does not throw', async () => {
    await expect(
      archiveProductOut({ shopifyProductId: 'gid://shopify/Product/1' }),
    ).resolves.toBeUndefined();
    expect(shopifySync.archiveProduct).not.toHaveBeenCalled();
  });

  it('syncInventoryOut makes zero shopifySync/Mongo calls and does not throw', async () => {
    await expect(syncInventoryOut('prod1', 'TEE-S')).resolves.toBeUndefined();
    expect(shopifySync.pushInventory).not.toHaveBeenCalled();
    expect(Product.findOne).not.toHaveBeenCalled();
  });
});

describe('syncProductOut — id persistence (D-08)', () => {
  beforeEach(() => {
    configure();
  });

  it('calls pushProduct and persists the returned Shopify ids onto the Mongo doc', async () => {
    shopifySync.pushProduct.mockResolvedValue({
      shopifyProductId: 'gid://shopify/Product/100',
      variants: [
        {
          sku: 'TEE-S',
          shopifyVariantId: 'gid://shopify/ProductVariant/200',
          shopifyInventoryItemId: 'gid://shopify/InventoryItem/300',
        },
      ],
    });

    const product = {
      name: 'Tee',
      variants: [{ sku: 'TEE-S', syncPending: true }],
      save: jest.fn().mockResolvedValue(true),
    };

    await syncProductOut(product);

    expect(shopifySync.pushProduct).toHaveBeenCalledWith(product);
    expect(product.shopifyProductId).toBe('gid://shopify/Product/100');
    expect(product.variants[0].shopifyVariantId).toBe('gid://shopify/ProductVariant/200');
    expect(product.variants[0].shopifyInventoryItemId).toBe('gid://shopify/InventoryItem/300');
    expect(product.variants[0].syncPending).toBe(false);
    expect(product.save).toHaveBeenCalledTimes(1);
  });

  it('never throws when pushProduct rejects (best-effort)', async () => {
    shopifySync.pushProduct.mockRejectedValue(new Error('Shopify down'));
    const product = { name: 'Tee', variants: [{ sku: 'TEE-S' }], save: jest.fn() };
    await expect(syncProductOut(product)).resolves.toBeUndefined();
    expect(product.save).not.toHaveBeenCalled();
  });
});

describe('archiveProductOut — soft-delete mirror (D-14)', () => {
  beforeEach(() => {
    configure();
  });

  it('calls archiveProduct when the product carries a shopifyProductId', async () => {
    shopifySync.archiveProduct.mockResolvedValue({});
    await archiveProductOut({ shopifyProductId: 'gid://shopify/Product/100' });
    expect(shopifySync.archiveProduct).toHaveBeenCalledWith('gid://shopify/Product/100');
  });

  it('no-ops when the product has no shopifyProductId (never pushed yet)', async () => {
    await archiveProductOut({ name: 'Never synced' });
    expect(shopifySync.archiveProduct).not.toHaveBeenCalled();
  });

  it('never throws when archiveProduct rejects (best-effort)', async () => {
    shopifySync.archiveProduct.mockRejectedValue(new Error('Shopify down'));
    await expect(
      archiveProductOut({ shopifyProductId: 'gid://shopify/Product/100' }),
    ).resolves.toBeUndefined();
  });
});

describe('syncInventoryOut — absolute-count push + syncPending retry marking', () => {
  beforeEach(() => {
    configure();
  });

  it('pushes the ABSOLUTE post-write stock (D-06) for a variant with an inventory-item id', async () => {
    mockProduct.findOne.mockResolvedValue({
      variants: [{ sku: 'TEE-S', stock: 7, shopifyInventoryItemId: 'gid://shopify/InventoryItem/300' }],
    });
    shopifySync.pushInventory.mockResolvedValue({});

    await syncInventoryOut('prod1', 'TEE-S');

    expect(shopifySync.pushInventory).toHaveBeenCalledWith('gid://shopify/InventoryItem/300', 7);
    expect(mockProduct.updateOne).not.toHaveBeenCalled();
  });

  it('no-ops (no push) when the variant has no shopifyInventoryItemId yet', async () => {
    mockProduct.findOne.mockResolvedValue({
      variants: [{ sku: 'TEE-S', stock: 7 }],
    });

    await syncInventoryOut('prod1', 'TEE-S');

    expect(shopifySync.pushInventory).not.toHaveBeenCalled();
  });

  it('sets syncPending:true and resolves without throwing when the push fails (D-05)', async () => {
    mockProduct.findOne.mockResolvedValue({
      variants: [{ sku: 'TEE-S', stock: 7, shopifyInventoryItemId: 'gid://shopify/InventoryItem/300' }],
    });
    shopifySync.pushInventory.mockRejectedValue(new Error('429 throttled'));
    mockProduct.updateOne.mockResolvedValue({});

    await expect(syncInventoryOut('prod1', 'TEE-S')).resolves.toBeUndefined();

    expect(mockProduct.updateOne).toHaveBeenCalledWith(
      { _id: 'prod1', 'variants.sku': 'TEE-S' },
      { $set: { 'variants.$.syncPending': true } },
    );
  });
});
