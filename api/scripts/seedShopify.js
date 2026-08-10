'use strict';

/**
 * One-time Mongo -> Shopify catalog seed (Phase 07-09, SHOP-18; D-01/D-08/D-09).
 *
 * This is the D-09 bootstrap export: Shopify currently holds only a throwaway
 * test product; Mongo holds the real historical catalog. This script creates
 * each historical Mongo product in Shopify (via shopifySync.pushProduct),
 * captures the returned Shopify ids back onto the Mongo docs (D-08 identity
 * link), then sets Shopify stock from Mongo (Mongo = inventory master, D-01).
 *
 * ⚠️  MANUAL PRE-STEP (D-09): before running this, DELETE the throwaway Shopify
 *     test product by hand in the Shopify admin (Products). We deliberately do
 *     NOT build one-off logic to detect/remove it — see docs/shopify-sync.md.
 *
 * Idempotent: a product that already carries a shopifyProductId is skipped, so
 * a re-run after a partial failure only exports the still-unlinked products.
 *
 * SKU BOOTSTRAP ONLY (Pitfall 5): the create response is matched back to the
 * Mongo variants BY SKU *inline here*. This SKU-matching is intentionally NOT
 * extracted into a shared helper — steady-state webhook/sync matching is
 * id-first (shopifyVariantId), a separate concern. Do not share this code.
 *
 * Usage: npm run seed:shopify --workspace=api   (run once, with prod env vars)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const Product = require('../models/Product');
const { pushProduct, pushInventory } = require('../services/shopifySync');

// Fail loudly BEFORE any DB/Shopify write if the store is not configured, so we
// never perform a partial export against a misconfigured environment.
const REQUIRED_ENV = [
  'MONGODB_URI',
  'SHOPIFY_SHOP_DOMAIN',
  'SHOPIFY_API_VERSION',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'SHOPIFY_LOCATION_ID',
];

function assertConfigured() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Shopify seed aborted — missing required env var(s): ${missing.join(', ')}. ` +
        'Set them (see docs/shopify-sync.md) before running the one-time seed.'
    );
  }
}

/**
 * Persists the captured Shopify ids onto one Mongo product doc. The product id
 * is set on the doc; each returned variant is matched to a Mongo variant BY SKU
 * (bootstrap link only, Pitfall 5) and its shopifyVariantId +
 * shopifyInventoryItemId recorded. Returns the saved doc.
 */
async function captureIds(doc, captured) {
  doc.shopifyProductId = captured.shopifyProductId;
  for (const cv of captured.variants) {
    const variant = doc.variants.find((v) => v.sku === cv.sku);
    if (!variant) {
      console.warn(
        `   ⚠️  Shopify returned SKU "${cv.sku}" with no matching Mongo variant on "${doc.name}" — skipping id capture for it.`
      );
      continue;
    }
    variant.shopifyVariantId = cv.shopifyVariantId;
    variant.shopifyInventoryItemId = cv.shopifyInventoryItemId;
  }
  await doc.save();
  return doc;
}

async function seedShopify() {
  assertConfigured();
  await connectDatabase();

  try {
    // Only active products are exported; already-linked products are skipped
    // (idempotent re-run) rather than re-created.
    const products = await Product.find({ active: true });
    console.log(`🛒 Shopify seed: ${products.length} active product(s) found in Mongo.`);

    let exported = 0;
    let skipped = 0;

    for (const product of products) {
      if (product.shopifyProductId) {
        skipped += 1;
        console.log(`⏭️  Skipping "${product.name}" — already linked (${product.shopifyProductId}).`);
        continue;
      }

      console.log(`⬆️  Exporting "${product.name}"...`);

      // 1) Push content (create) and capture the returned Shopify ids (D-08).
      const captured = await pushProduct(product);
      await captureIds(product, captured);

      // 2) Set Shopify stock from Mongo — Mongo is the inventory master (D-01).
      //    Absolute count, never a delta (D-06).
      for (const variant of product.variants) {
        if (variant.active === false) continue; // retired variant, not sellable
        if (!variant.shopifyInventoryItemId) {
          console.warn(
            `   ⚠️  No inventory-item id captured for SKU "${variant.sku}" — cannot seed its stock.`
          );
          continue;
        }
        await pushInventory(variant.shopifyInventoryItemId, variant.stock || 0);
        console.log(`   📦 ${variant.sku}: stock set to ${variant.stock || 0}.`);
      }

      exported += 1;
      console.log(`   ✅ "${product.name}" -> ${product.shopifyProductId}`);
    }

    console.log(`\n✅ Shopify seed complete: ${exported} exported, ${skipped} already-linked (skipped).`);
  } finally {
    await mongoose.connection.close();
  }
}

seedShopify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Shopify seed failed:', error.message);
    console.error('Full error:', error);
    // Best-effort close; ignore secondary errors.
    mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
