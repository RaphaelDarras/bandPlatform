'use strict';

/**
 * Outbound Shopify push orchestration (Phase 07-07, SHOP-18;
 * D-01/D-04/D-05/D-06/D-08).
 *
 * The single best-effort, config-guarded entry point every Mongo write path
 * (products.js, inventory.js, and the POS sales.js batch/void/unvoid path) calls
 * to mirror a write to Shopify. It decides WHEN to push (per D-04) and owns the
 * Mongo id write-back that shopifySync deliberately does NOT do — keeping
 * shopifySync a pure external-I/O mapper (boundary discipline, mirrors
 * stripeClient/webhook split).
 *
 * Every exported function is BEST-EFFORT (threat T-07-13): it is guarded by a
 * config check so unconfigured environments (and the existing test suites)
 * no-op with zero Shopify work, and it NEVER throws to its caller — a Shopify
 * outage must never fail a product write, an inventory adjustment, or (most
 * importantly) a concert POS `/batch` sale. Inventory push failures set the
 * variant `syncPending:true` (D-05 confirm-and-retry) so a later pass can retry;
 * they still resolve rather than reject.
 *
 * Inventory pushes send the ABSOLUTE post-write count (`variant.stock`), never a
 * delta (D-06) — inherited from shopifySync.pushInventory.
 */

const shopifySync = require('./shopifySync');
const Product = require('../models/Product');

/**
 * The config guard (D-04): outbound pushes only fire when BOTH the OAuth client
 * id and the shop domain are present. Read at call time (never cached) so a
 * process that gains credentials mid-life starts mirroring without a restart,
 * and — critically — so unconfigured test/dev environments make zero Shopify
 * calls. Mirrors shopifyClient's boot-safe "read env only when used" discipline.
 *
 * @returns {boolean}
 */
function isShopifyConfigured() {
  return Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_SHOP_DOMAIN);
}

/**
 * Pushes a product's content to Shopify and persists the returned Shopify ids
 * (product id + per-variant variant/inventory-item ids) back onto the Mongo doc
 * (D-08), clearing each variant's syncPending marker. No-ops when unconfigured.
 * Best-effort: logs and swallows any push/save failure, never throwing.
 *
 * @param {import('mongoose').Document|object} product - the Mongo Product doc.
 * @returns {Promise<void>}
 */
async function syncProductOut(product) {
  if (!isShopifyConfigured()) return;

  try {
    const result = await shopifySync.pushProduct(product);
    if (!result) return;

    product.shopifyProductId = result.shopifyProductId;

    // Link each Mongo variant to the ids Shopify returned. First-link matching
    // is by SKU (the only shared key before ids exist); once persisted, the
    // stored ids are what future pulls match on (D-08 / Pitfall 5).
    const bySku = new Map((result.variants || []).map((v) => [v.sku, v]));
    for (const variant of product.variants || []) {
      const match = bySku.get(variant.sku);
      if (match) {
        variant.shopifyVariantId = match.shopifyVariantId;
        variant.shopifyInventoryItemId = match.shopifyInventoryItemId;
      }
      // The content push carried this variant's state to Shopify — clear the
      // retry marker so a stale pending flag does not linger.
      variant.syncPending = false;
    }

    if (typeof product.save === 'function') {
      await product.save();
    }
  } catch (error) {
    console.error('[shopifyOutbound] syncProductOut failed (best-effort):', error.message);
  }
}

/**
 * Soft-deletes (archives to DRAFT) a product on Shopify. No-ops when
 * unconfigured or when the product was never pushed (no shopifyProductId).
 * Best-effort: logs and swallows any failure, never throwing.
 *
 * @param {import('mongoose').Document|object} product - the Mongo Product doc.
 * @returns {Promise<void>}
 */
async function archiveProductOut(product) {
  if (!isShopifyConfigured()) return;
  if (!product || !product.shopifyProductId) return;

  try {
    await shopifySync.archiveProduct(product.shopifyProductId);
  } catch (error) {
    console.error('[shopifyOutbound] archiveProductOut failed (best-effort):', error.message);
  }
}

/**
 * Pushes a single variant's ABSOLUTE post-write stock count to Shopify (D-06),
 * loading the current authoritative value from Mongo so callers only pass ids.
 * No-ops when unconfigured, when the product/variant is gone, or when the
 * variant has no Shopify inventory-item id yet (not pushed). On a push failure
 * it sets that variant's syncPending:true (D-05) and resolves. NEVER throws.
 *
 * @param {string} productId - the Mongo product _id.
 * @param {string} variantSku - the variant SKU.
 * @returns {Promise<void>}
 */
async function syncInventoryOut(productId, variantSku) {
  if (!isShopifyConfigured()) return;

  try {
    const product = await Product.findOne({ _id: productId, 'variants.sku': variantSku });
    if (!product) return;

    const variant = product.variants.find((v) => v.sku === variantSku);
    if (!variant || !variant.shopifyInventoryItemId) return;

    try {
      // D-06: absolute post-write count — variant.stock verbatim, no delta.
      await shopifySync.pushInventory(variant.shopifyInventoryItemId, variant.stock);
    } catch (pushError) {
      // D-05: confirm-and-retry — mark for a later reconcile pass, never block.
      await Product.updateOne(
        { _id: productId, 'variants.sku': variantSku },
        { $set: { 'variants.$.syncPending': true } },
      );
      console.error(
        '[shopifyOutbound] syncInventoryOut push failed, marked syncPending (best-effort):',
        pushError.message,
      );
    }
  } catch (error) {
    console.error('[shopifyOutbound] syncInventoryOut failed (best-effort):', error.message);
  }
}

module.exports = {
  isShopifyConfigured,
  syncProductOut,
  archiveProductOut,
  syncInventoryOut,
};
