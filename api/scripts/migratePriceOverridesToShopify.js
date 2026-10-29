'use strict';

/**
 * One-off: re-key Concert.priceOverrides[].productId from Mongo Product
 * ObjectIds to Shopify product GIDs (07.1, D-05).
 *
 * - Dry run by default; pass --apply to write.
 * - Idempotent: overrides already holding a gid://shopify/Product/ value are skipped.
 * - Reads the archived Product collection (read-only, never written).
 * - Only $set priceOverrides on concerts that actually changed.
 *
 * Usage: node api/scripts/migratePriceOverridesToShopify.js [--apply]
 * (dry run after the 07.1 API deploy in plan 15; --apply in plan 16,
 * before the new APK is installed.)
 */

const GID_PREFIX = 'gid://shopify/Product/';

function toProductGid(id) {
  if (id === undefined || id === null || id === '') return null;
  const s = String(id).trim();
  if (!s) return null;
  if (s.startsWith(GID_PREFIX)) return s;
  return `${GID_PREFIX}${s}`;
}

function remapOverrides(overrides, productsById) {
  const unmapped = [];
  let changed = 0;
  const out = (overrides || []).map((ov) => {
    const current = ov.productId === undefined || ov.productId === null ? '' : String(ov.productId);
    if (current.startsWith(GID_PREFIX)) return ov;
    const product = productsById[current];
    const gid = product ? toProductGid(product.shopifyProductId) : null;
    if (!gid) {
      unmapped.push(current);
      return ov;
    }
    changed += 1;
    return { ...ov, productId: gid };
  });
  return { overrides: out, changed, unmapped };
}

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const { connectDatabase } = require('../config/database');
  const Concert = require('../models/Concert');
  const Product = require('../models/Product');

  const apply = process.argv.includes('--apply');
  console.log(apply ? 'Mode: APPLY' : 'Mode: DRY RUN (pass --apply to write)');

  await connectDatabase();

  const concerts = await Concert.collection
    .find({ 'priceOverrides.0': { $exists: true } })
    .toArray();

  const ids = new Set();
  for (const c of concerts) {
    for (const ov of c.priceOverrides) {
      const v = String(ov.productId);
      if (!v.startsWith(GID_PREFIX)) ids.add(v);
    }
  }

  const productsById = {};
  if (ids.size > 0) {
    const products = await Product.find({ _id: { $in: [...ids] } }).lean();
    for (const p of products) productsById[String(p._id)] = p;
  }

  let totalChanged = 0;
  let totalUnmapped = 0;
  for (const c of concerts) {
    const { overrides, changed, unmapped } = remapOverrides(c.priceOverrides, productsById);
    console.log(`${c._id}: changed ${changed}, unmapped [${unmapped.join(', ')}]`);
    totalChanged += changed;
    totalUnmapped += unmapped.length;
    if (apply && changed > 0) {
      await Concert.collection.updateOne({ _id: c._id }, { $set: { priceOverrides: overrides } });
    }
  }

  console.log(`Totals: concerts ${concerts.length}, changed ${totalChanged}, unmapped ${totalUnmapped}`);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { remapOverrides, toProductGid };
