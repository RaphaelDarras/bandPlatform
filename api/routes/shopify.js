'use strict';

/**
 * Shopify reconcile route (Phase 07-08, SHOP-18/SHOP-19; D-05/D-06,
 * T-07-03/T-07-02/T-07-14).
 *
 * The infrequent reconciliation backstop that guarantees Shopify converges to
 * Mongo's authoritative inventory. D-05 downgrades reconcile to an infrequent
 * pass (nightly/weekly) because per-write confirm-and-retry already covers the
 * oversell-critical direction; this sweep catches the residuals: pushes that
 * returned 200 but did not apply, manual Shopify-admin stock edits (deliberately
 * NOT webhook-synced, Pitfall 3), `syncPending` retries (D-05), and deploy gaps.
 * It re-pushes each active variant's ABSOLUTE Mongo count (D-06) via
 * shopifyOutbound.syncInventoryOut.
 *
 * AUTH (T-07-03): the caller is a scheduled GitHub Actions job with NO user
 * session, so this route is NOT behind the JWT middleware. It is gated by a
 * shared-secret header (`X-Reconcile-Secret`) compared with crypto.timingSafeEqual
 * (length-guarded) against process.env.SHOPIFY_RECONCILE_SECRET. A missing/unset
 * or mismatched secret is rejected 401 with zero Shopify work — an open endpoint
 * would burn the Admin API rate budget (DoS).
 *
 * Note: this router is mounted into api/index.js in plan 07-10; it is tested
 * standalone here (api/tests/shopifyReconcile.test.js).
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Product = require('../models/Product');
const shopifyOutbound = require('../services/shopifyOutbound');

/**
 * Shared-secret guard (T-07-03). Reads the X-Reconcile-Secret header and compares
 * it to SHOPIFY_RECONCILE_SECRET with crypto.timingSafeEqual — never `===`, which
 * would leak the secret length/prefix via early-return timing. Because
 * timingSafeEqual requires equal-length buffers, an explicit length guard runs
 * first (a mismatch there is itself a rejection, not an error). A missing header
 * or an unset server secret is rejected so the endpoint NEVER runs unauthenticated.
 */
function requireReconcileSecret(req, res, next) {
  const expected = process.env.SHOPIFY_RECONCILE_SECRET;
  const provided = req.headers['x-reconcile-secret'];

  if (!expected || typeof provided !== 'string' || provided.length === 0) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');

  // timingSafeEqual throws on unequal lengths; guard first so a length mismatch
  // is a clean 401 rather than a 500.
  if (expectedBuf.length !== providedBuf.length) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

/**
 * POST /reconcile
 * Re-asserts Mongo's authoritative absolute stock to Shopify for every eligible
 * active variant and retries any variant left syncPending (D-05). Shared-secret
 * gated (above). No-ops with a clear 200 body when Shopify is unconfigured so the
 * scheduled trigger + keep-alive ping never crashes in an unconfigured environment.
 *
 * A variant is eligible when it is active (D-15) AND either already carries a
 * shopifyInventoryItemId (has been pushed, so drift is possible) or is flagged
 * syncPending (a prior push failed and needs a retry). syncInventoryOut is itself
 * best-effort and config-guarded — it loads the current authoritative stock and
 * pushes the absolute count (D-06), re-marking syncPending on failure.
 *
 * Returns a summary including lastReconcileAt so Pitfall 6 (GitHub Actions
 * 60-day auto-disable) is observable — a stale timestamp signals a dormant cron.
 */
router.post('/reconcile', requireReconcileSecret, async (req, res) => {
  try {
    if (!shopifyOutbound.isShopifyConfigured()) {
      return res.status(200).json({ reconciled: 0, skipped: 'shopify-not-configured' });
    }

    const products = await Product.find({ active: true });

    let reconciled = 0;
    let syncPendingRetried = 0;

    for (const product of products) {
      const productId = product._id ? product._id.toString() : product.id;
      for (const variant of product.variants || []) {
        // D-15: never touch a retired variant, even if it still carries a Shopify id.
        if (variant.active === false) continue;

        const eligible = Boolean(variant.shopifyInventoryItemId) || Boolean(variant.syncPending);
        if (!eligible) continue;

        // Best-effort absolute-count push (D-06); loads current stock from Mongo.
        await shopifyOutbound.syncInventoryOut(productId, variant.sku);
        reconciled += 1;
        if (variant.syncPending) syncPendingRetried += 1;
      }
    }

    return res.status(200).json({
      reconciled,
      syncPendingRetried,
      lastReconcileAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reconcile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
