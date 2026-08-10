'use strict';

/**
 * Unit tests for the outbound Shopify sync engine (Phase 07-05, SHOP-18).
 *
 * `../services/shopifyClient` is fully mocked so NO network is hit and no real
 * Shopify env values are required (plain-unit style, mirroring amounts.test.js).
 * These tests pin the mapping contract 07-06/07-07 rely on:
 *   pushProduct(mongoProduct)  -> { shopifyProductId, variants:[{ sku, shopifyVariantId, shopifyInventoryItemId }] }
 *   archiveProduct(shopifyProductId)
 *   pushInventory(shopifyInventoryItemId, absoluteQuantity)
 */

jest.mock('../services/shopifyClient', () => ({ shopifyRequest: jest.fn() }));

const { shopifyRequest } = require('../services/shopifyClient');
const { pushProduct, archiveProduct, pushInventory } = require('../services/shopifySync');

// A canned productSet response the caller persists back onto the Mongo doc (D-08).
function cannedProductSetResponse(status = 'ACTIVE') {
  return {
    productSet: {
      product: {
        id: 'gid://shopify/Product/100',
        status,
        variants: {
          nodes: [
            {
              id: 'gid://shopify/ProductVariant/200',
              sku: 'TEE-S',
              inventoryItem: { id: 'gid://shopify/InventoryItem/300' },
            },
          ],
        },
      },
      userErrors: [],
    },
  };
}

function baseProduct(overrides = {}) {
  return {
    name: 'Hurakan Tour Tee',
    description: 'Official tour tee',
    basePrice: 20,
    active: true,
    images: ['https://cdn.example/tee.png'],
    variants: [
      { sku: 'TEE-S', size: 'S', stock: 10, priceAdjustment: 5, active: true },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pushProduct — productSet content push (D-08/D-10/D-12/D-13/D-14/D-15)', () => {
  it('omits input.id when the product has no shopifyProductId (CREATE branch)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());

    await pushProduct(baseProduct());

    const [mutation, variables] = shopifyRequest.mock.calls[0];
    expect(mutation).toMatch(/productSet/);
    expect(mutation).toMatch(/synchronous:\s*true/);
    expect(variables.input.id).toBeUndefined();
  });

  it('sends input.id when the product already has a shopifyProductId (UPDATE branch)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());

    await pushProduct(baseProduct({ shopifyProductId: 'gid://shopify/Product/100' }));

    const [, variables] = shopifyRequest.mock.calls[0];
    expect(variables.input.id).toBe('gid://shopify/Product/100');
  });

  it('maps status ACTIVE for an active product and DRAFT for an inactive one (D-14)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());
    await pushProduct(baseProduct({ active: true }));
    expect(shopifyRequest.mock.calls[0][1].input.status).toBe('ACTIVE');

    shopifyRequest.mockClear();
    shopifyRequest.mockResolvedValue(cannedProductSetResponse('DRAFT'));
    await pushProduct(baseProduct({ active: false }));
    expect(shopifyRequest.mock.calls[0][1].input.status).toBe('DRAFT');
  });

  it('sets the variant price to basePrice + priceAdjustment as a string (D-12)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());

    await pushProduct(baseProduct({ basePrice: 20, variants: [{ sku: 'TEE-S', size: 'S', stock: 10, priceAdjustment: 5, active: true }] }));

    const price = shopifyRequest.mock.calls[0][1].input.variants[0].price;
    expect(price).toBe('25');
    expect(typeof price).toBe('string');
  });

  it('emits the product images for Shopify to re-host (D-13)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());

    await pushProduct(baseProduct({ images: ['https://cdn.example/a.png', 'https://cdn.example/b.png'] }));

    const input = shopifyRequest.mock.calls[0][1].input;
    const serialized = JSON.stringify(input);
    expect(serialized).toContain('https://cdn.example/a.png');
    expect(serialized).toContain('https://cdn.example/b.png');
  });

  it('captures the returned Shopify ids keyed by SKU (D-08)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());

    const result = await pushProduct(baseProduct());

    expect(result).toEqual({
      shopifyProductId: 'gid://shopify/Product/100',
      variants: [
        {
          sku: 'TEE-S',
          shopifyVariantId: 'gid://shopify/ProductVariant/200',
          shopifyInventoryItemId: 'gid://shopify/InventoryItem/300',
        },
      ],
    });
  });

  it('deactivates an active:false variant on the Shopify side — it is NOT emitted as a live sellable variant (D-15)', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse());

    await pushProduct(
      baseProduct({
        variants: [
          { sku: 'TEE-S', size: 'S', stock: 10, priceAdjustment: 5, active: true },
          { sku: 'TEE-XL', size: 'XL', stock: 3, priceAdjustment: 5, active: false },
        ],
      }),
    );

    const emitted = shopifyRequest.mock.calls[0][1].input.variants;
    const emittedSkus = emitted.map((v) => v.sku);
    expect(emittedSkus).toContain('TEE-S');
    expect(emittedSkus).not.toContain('TEE-XL');
  });

  it('throws when the response carries userErrors', async () => {
    shopifyRequest.mockResolvedValue({
      productSet: { product: null, userErrors: [{ field: ['input'], message: 'bad title' }] },
    });

    await expect(pushProduct(baseProduct())).rejects.toThrow(/userErrors|bad title/i);
  });
});

describe('archiveProduct — soft-delete via status DRAFT (D-14)', () => {
  it('issues a productSet carrying the id and status DRAFT', async () => {
    shopifyRequest.mockResolvedValue(cannedProductSetResponse('DRAFT'));

    await archiveProduct('gid://shopify/Product/100');

    const [mutation, variables] = shopifyRequest.mock.calls[0];
    expect(mutation).toMatch(/productSet/);
    expect(variables.input.id).toBe('gid://shopify/Product/100');
    expect(variables.input.status).toBe('DRAFT');
  });

  it('throws when the archive response carries userErrors', async () => {
    shopifyRequest.mockResolvedValue({
      productSet: { product: null, userErrors: [{ field: ['id'], message: 'not found' }] },
    });

    await expect(archiveProduct('gid://shopify/Product/999')).rejects.toThrow(/userErrors|not found/i);
  });
});

describe('pushInventory — inventorySetQuantities absolute-count push (D-01/D-06)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, SHOPIFY_LOCATION_ID: 'gid://shopify/Location/42' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  function cannedInventoryResponse() {
    return {
      inventorySetQuantities: {
        inventoryAdjustmentGroup: { createdAt: '2026-08-10T00:00:00Z', reason: 'correction' },
        userErrors: [],
      },
    };
  }

  it('issues an inventorySetQuantities mutation with name:available and ignoreCompareQuantity:true', async () => {
    shopifyRequest.mockResolvedValue(cannedInventoryResponse());

    await pushInventory('gid://shopify/InventoryItem/300', 12);

    const [mutation, variables] = shopifyRequest.mock.calls[0];
    expect(mutation).toMatch(/inventorySetQuantities/);
    expect(variables.input.name).toBe('available');
    expect(variables.input.ignoreCompareQuantity).toBe(true);
  });

  it('sends the ABSOLUTE quantity passed in — 12 in, 12 out, no delta arithmetic (D-06)', async () => {
    shopifyRequest.mockResolvedValue(cannedInventoryResponse());

    await pushInventory('gid://shopify/InventoryItem/300', 12);

    const entry = shopifyRequest.mock.calls[0][1].input.quantities[0];
    expect(entry.quantity).toBe(12);
    expect(entry.inventoryItemId).toBe('gid://shopify/InventoryItem/300');
    // Prove no subtraction/delta leaked into the call args: exactly the input value.
    const serialized = JSON.stringify(shopifyRequest.mock.calls[0][1]);
    expect(serialized).toContain('"quantity":12');
  });

  it('sends 0 as an absolute 0 (out-of-stock), not an omission or delta', async () => {
    shopifyRequest.mockResolvedValue(cannedInventoryResponse());

    await pushInventory('gid://shopify/InventoryItem/300', 0);

    expect(shopifyRequest.mock.calls[0][1].input.quantities[0].quantity).toBe(0);
  });

  it('targets the pinned SHOPIFY_LOCATION_ID', async () => {
    shopifyRequest.mockResolvedValue(cannedInventoryResponse());

    await pushInventory('gid://shopify/InventoryItem/300', 5);

    expect(shopifyRequest.mock.calls[0][1].input.quantities[0].locationId).toBe('gid://shopify/Location/42');
  });

  it('throws when the response carries userErrors', async () => {
    shopifyRequest.mockResolvedValue({
      inventorySetQuantities: {
        inventoryAdjustmentGroup: null,
        userErrors: [{ field: ['quantities'], message: 'invalid item', code: 'INVALID' }],
      },
    });

    await expect(pushInventory('gid://shopify/InventoryItem/bad', 5)).rejects.toThrow(/userErrors|invalid item/i);
  });
});
