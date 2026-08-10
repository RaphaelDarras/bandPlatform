'use strict';

/**
 * Shopify outbound sync engine (Phase 07-05, SHOP-18;
 * D-01/D-04/D-06/D-08/D-10/D-12/D-13/D-14/D-15).
 *
 * This file only talks to Shopify — through shopifyClient.shopifyRequest — it
 * does NOT decide WHEN to push (route hooks / webhook handler / reconcile job
 * own that per D-04) and it does NOT read or write Mongo (Order/Sale/Product).
 * It maps an already-resolved Mongo product/stock value onto the Shopify
 * GraphQL shape and returns the ids the caller persists back onto the Mongo doc
 * (D-08). Boundary discipline mirrors stripeClient.js: single-purpose external
 * I/O, single source of truth kept elsewhere.
 *
 * Content pushes use `productSet` (one create-or-update mutation, D-10;
 * price = basePrice + priceAdjustment per D-12; images sent for Shopify to
 * re-host per D-13). Inventory pushes use `inventorySetQuantities` with the
 * ABSOLUTE authoritative count (D-01/D-06 — never a delta), which deliberately
 * overwrites Shopify's own checkout auto-decrement to prevent double-counting.
 */

const { randomUUID } = require('node:crypto');
const { shopifyRequest } = require('./shopifyClient');

// RESEARCH Pattern 4. `synchronous: true` is safe for this small catalog (well
// under the 2048-variant ceiling); no async productSetOperation polling needed.
const PRODUCT_SET_MUTATION = `
  mutation ProductSet($input: ProductSetInput!) {
    productSet(synchronous: true, input: $input) {
      product {
        id
        status
        variants(first: 50) {
          nodes { id sku inventoryItem { id } }
        }
      }
      userErrors { field message }
    }
  }
`;

// RESEARCH Pattern 5 / Open Q1 / Assumption A3, now RESOLVED against the live API
// (2026-08): as of Admin API 2026-04+, `inventorySetQuantities` REQUIRES the
// `@idempotent(key:)` directive with a unique key per request (a BAD_REQUEST is
// returned otherwise). We pass a fresh randomUUID per call. Setting to an absolute
// value is itself idempotent, so a distinct key per logical set is correct; a true
// retry layer (if ever added in shopifyClient) would reuse the key to dedupe.
const INVENTORY_SET_MUTATION = `
  mutation SetQty($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
    inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
      inventoryAdjustmentGroup { createdAt reason }
      userErrors { field message code }
    }
  }
`;

// Admin API 2026-07's `inventorySetQuantities` is a compare-and-set: each item
// must carry `changeFromQuantity` (the expected current value). There is no
// `ignoreCompareQuantity`, and `inventorySetOnHandQuantities` is deprecated. So we
// read the current 'available' at the pinned location first, then set absolutely
// from that baseline. (Verified via live-schema introspection, 2026-08.)
const INVENTORY_LEVEL_QUERY = `
  query CurrentLevel($itemId: ID!, $locationId: ID!) {
    inventoryItem(id: $itemId) {
      inventoryLevel(locationId: $locationId) {
        quantities(names: ["available"]) { name quantity }
      }
    }
  }
`;

/**
 * Throws if a mutation payload carries userErrors, surfacing them so the caller
 * can convert to an HTTP status / retry decision (thin "let it throw" wrapper).
 */
function throwOnUserErrors(mutationName, payload) {
  const userErrors = payload && payload.userErrors;
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    throw new Error(`Shopify ${mutationName} userErrors: ${JSON.stringify(userErrors)}`);
  }
}

/**
 * Builds the option definitions (option1=Size, option2=Color per D — default
 * mapping) from the active variants' populated size/color values.
 */
function buildProductOptions(activeVariants) {
  const options = [];
  const sizes = [...new Set(activeVariants.map((v) => v.size).filter(Boolean))];
  const colors = [...new Set(activeVariants.map((v) => v.color).filter(Boolean))];
  if (sizes.length > 0) {
    options.push({ name: 'Size', values: sizes.map((name) => ({ name })) });
  }
  if (colors.length > 0) {
    options.push({ name: 'Color', values: colors.map((name) => ({ name })) });
  }
  return options;
}

/**
 * Maps one Mongo variant onto a ProductVariantSetInput entry. Inventory is only
 * seeded on create (steady-state stock is owned by pushInventory / D-01).
 */
function buildVariantInput(variant, basePrice, { isCreate }) {
  const optionValues = [];
  if (variant.size) optionValues.push({ optionName: 'Size', name: variant.size });
  if (variant.color) optionValues.push({ optionName: 'Color', name: variant.color });

  const variantInput = {
    sku: variant.sku,
    // D-12: authoritative sell price is the product base plus the per-variant
    // adjustment, sent to Shopify as a string.
    price: String(basePrice + (variant.priceAdjustment || 0)),
    optionValues,
  };

  if (isCreate && process.env.SHOPIFY_LOCATION_ID) {
    variantInput.inventoryQuantities = [
      {
        locationId: process.env.SHOPIFY_LOCATION_ID,
        name: 'available',
        quantity: variant.stock || 0,
      },
    ];
  }

  return variantInput;
}

/**
 * Pushes a Mongo product's content (title/description/images/price + variants)
 * to Shopify via a single productSet mutation.
 *
 * CREATE vs UPDATE is decided by the presence of mongoProduct.shopifyProductId
 * (D-10): present -> input.id set (update); absent -> omitted (create).
 *
 * D-15 variant deactivation: a Mongo variant with `active === false` is
 * deactivated on the Shopify side by being EXCLUDED from the authoritative
 * productSet variants payload (productSet treats the variant list as
 * authoritative and drops omitted variants). This is the outbound mirror of
 * 07-06's inbound "dropped Shopify variant -> Mongo variant active:false +
 * stock:0" (kept for order/audit history, not sellable). This is a deliberate
 * filter branch, not accidental inclusion. (No per-variant enabled/status field
 * is used because verifying its existence needs a live-schema check the
 * mocked/config-guarded build path does not perform; exclusion is the plan's
 * documented default.)
 *
 * @param {object} mongoProduct - a Mongo Product doc/object with name,
 *   description, basePrice, active, images[], variants[] and optionally
 *   shopifyProductId.
 * @returns {Promise<{ shopifyProductId: string, variants: Array<{ sku: string,
 *   shopifyVariantId: string, shopifyInventoryItemId: string }> }>} the captured
 *   Shopify ids for the caller to persist (D-08).
 */
async function pushProduct(mongoProduct) {
  const isCreate = !mongoProduct.shopifyProductId;
  const activeVariants = (mongoProduct.variants || []).filter((v) => v.active !== false);

  const input = {
    title: mongoProduct.name,
    descriptionHtml: mongoProduct.description || '',
    // D-14: an inactive product is pushed as DRAFT (soft-hidden), active as ACTIVE.
    status: mongoProduct.active ? 'ACTIVE' : 'DRAFT',
    productOptions: buildProductOptions(activeVariants),
    // D-13: send the source image URLs so Shopify re-hosts them on its own CDN.
    files: (mongoProduct.images || []).map((url) => ({
      originalSource: url,
      contentType: 'IMAGE',
    })),
    variants: activeVariants.map((variant) =>
      buildVariantInput(variant, mongoProduct.basePrice, { isCreate }),
    ),
  };

  // D-10: identify by the stored Shopify id when it exists (update), omit to create.
  if (mongoProduct.shopifyProductId) {
    input.id = mongoProduct.shopifyProductId;
  }

  const data = await shopifyRequest(PRODUCT_SET_MUTATION, { input });
  const result = data.productSet;
  throwOnUserErrors('productSet', result);

  const product = result.product;
  return {
    shopifyProductId: product.id,
    variants: product.variants.nodes.map((node) => ({
      sku: node.sku,
      shopifyVariantId: node.id,
      shopifyInventoryItemId: node.inventoryItem.id,
    })),
  };
}

/**
 * Soft-deletes a product on Shopify by flipping its status to DRAFT (D-14 —
 * retire, never hard-delete, preserving order/audit history).
 *
 * @param {string} shopifyProductId - the Shopify product gid to archive.
 * @returns {Promise<{ shopifyProductId: string, status: string }>}
 */
async function archiveProduct(shopifyProductId) {
  const data = await shopifyRequest(PRODUCT_SET_MUTATION, {
    input: { id: shopifyProductId, status: 'DRAFT' },
  });
  const result = data.productSet;
  throwOnUserErrors('productSet', result);
  return { shopifyProductId: result.product.id, status: result.product.status };
}

/**
 * Pushes a variant's ABSOLUTE post-write stock count to Shopify (D-01/D-06). The
 * passed quantity is sent verbatim as the new value — no delta arithmetic. Admin
 * API 2026-07 makes `inventorySetQuantities` a compare-and-set, so we first read
 * the current 'available' at the pinned location and pass it as
 * `changeFromQuantity`; the new absolute count then overwrites Shopify's own
 * checkout auto-decrement, preventing the double-count bug (threat T-07-10).
 * Reading the live baseline (rather than a blind overwrite) is in fact the
 * correct convergence: the orders/paid webhook already decremented both sides.
 * Targets the pinned SHOPIFY_LOCATION_ID.
 *
 * @param {string} shopifyInventoryItemId - the Shopify InventoryItem gid.
 * @param {number} absoluteQuantity - the authoritative absolute available count.
 * @returns {Promise<object>} the inventoryAdjustmentGroup from the response.
 */
async function pushInventory(shopifyInventoryItemId, absoluteQuantity) {
  const locationId = process.env.SHOPIFY_LOCATION_ID;

  // Read current 'available' to satisfy the compare-and-set (defaults to 0 when
  // the item isn't yet stocked at the location, e.g. a freshly created variant).
  const current = await shopifyRequest(INVENTORY_LEVEL_QUERY, {
    itemId: shopifyInventoryItemId,
    locationId,
  });
  const level = current.inventoryItem && current.inventoryItem.inventoryLevel;
  const availableEntry =
    level && level.quantities && level.quantities.find((q) => q.name === 'available');
  const changeFromQuantity = availableEntry ? availableEntry.quantity : 0;

  const data = await shopifyRequest(INVENTORY_SET_MUTATION, {
    input: {
      name: 'available',
      reason: 'correction',
      quantities: [
        {
          inventoryItemId: shopifyInventoryItemId,
          locationId,
          quantity: absoluteQuantity,
          changeFromQuantity,
        },
      ],
    },
    idempotencyKey: randomUUID(),
  });
  const result = data.inventorySetQuantities;
  throwOnUserErrors('inventorySetQuantities', result);
  return result.inventoryAdjustmentGroup;
}

module.exports = { pushProduct, archiveProduct, pushInventory };
