'use strict';

/**
 * Inbound Shopify webhook routes (Phase 07-06, SHOP-18/SHOP-19;
 * D-01/D-04/D-06/D-07/D-08/D-10/D-12/D-13/D-14/D-15).
 *
 * Mounted (plan 07-10) in api/index.js BEFORE the global express.json() — each
 * route below scopes express.raw({ type: 'application/json' }) so req.body is
 * the exact, unparsed byte buffer Shopify signed (RESEARCH Pitfall 4). HMAC
 * verification via verifyShopifyWebhook MUST be the FIRST statement of every
 * handler, returning 401 with ZERO DB access on failure so a forged event never
 * touches the database (T-07-01).
 *
 * Direction split (D-04/D-07):
 *   - orders/paid   -> deduct Mongo stock via the D-17 optimistic-lock path
 *                      ($elemMatch on version + versioned $inc — the SAME
 *                      mechanism as inventory.js /deduct, NOT webhooks.js's
 *                      lenient fulfillOrder $inc), write one Order audit, then
 *                      push the post-deduct ABSOLUTE count back to Shopify.
 *   - orders/cancelled + refunds/create -> restock (versioned $inc up) + push
 *                      the absolute count back.
 *   - products/create|update|delete -> content sync DOWN (Shopify master),
 *                      soft-delete only; NO inventory push (content path).
 *
 * Deliberately NOT handled: INVENTORY_LEVELS_UPDATE. Subscribing to it would
 * make every outbound pushInventory() re-fire a webhook back at us -> infinite
 * feedback loop (RESEARCH Pitfall 3 / T-07-11). D-07's topic set is complete
 * without it. Do NOT add an inventory-levels route here.
 *
 * Ack discipline (RESEARCH §always-ack, adapted for Shopify's ~48h retries):
 *   - Bad HMAC                         -> 401 (reject, never processed).
 *   - Malformed/unknown-id payload     -> 200 + log. A logic-level "we can't
 *                                         act on this" must NOT trigger a
 *                                         retry-storm (mirrors Stripe/PayPal).
 *   - Genuine transient DB error       -> 500 (surface it) so Shopify's own
 *                                         built-in retry (~48h backoff, D-05)
 *                                         does useful work. This is the one
 *                                         place we WANT a non-2xx, unlike the
 *                                         payment webhooks where the money is
 *                                         already captured.
 */

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { verifyShopifyWebhook } = require('../services/shopifyWebhookAuth');
const { pushInventory } = require('../services/shopifySync');

const rawJson = express.raw({ type: 'application/json' });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * HMAC gate (T-07-01). Returns true when the request is authentic. On false the
 * caller MUST return 401 before any DB access. Kept as a tiny wrapper so every
 * handler's first statement is a single readable guard.
 */
function isAuthentic(req) {
  return verifyShopifyWebhook(
    req.body,
    req.headers['x-shopify-hmac-sha256'],
    process.env.SHOPIFY_CLIENT_SECRET
  );
}

/**
 * Normalizes a Shopify id to its trailing numeric segment so a GraphQL GID
 * (gid://shopify/ProductVariant/123, stored by shopifySync on create) compares
 * equal to the bare numeric id a REST webhook payload carries (123). Belt-and-
 * suspenders alongside the SKU fallback below.
 */
function normId(value) {
  if (value == null) return null;
  const s = String(value);
  const slash = s.lastIndexOf('/');
  return slash >= 0 ? s.slice(slash + 1) : s;
}

function sameId(a, b) {
  const na = normId(a);
  const nb = normId(b);
  return na != null && nb != null && na === nb;
}

/**
 * Resolves a webhook line item to its Mongo { product, variant } by the stored
 * shopifyVariantId first (steady state, D-08/Pitfall 5), falling back to SKU
 * only as a bootstrap link. Returns null when nothing matches (unknown id).
 *
 * NOTE: this is deliberately NOT a shared helper with the seed script's
 * SKU-based bootstrap matcher (Pitfall 5) — steady-state matching is id-first.
 */
async function matchVariant({ variant_id: variantId, sku }) {
  const or = [];
  if (variantId != null) or.push({ 'variants.shopifyVariantId': String(variantId) });
  if (sku) or.push({ 'variants.sku': sku });
  if (or.length === 0) return null;

  const product = await Product.findOne({ $or: or });
  if (!product) return null;

  const variant = product.variants.find(
    (v) =>
      (variantId != null && sameId(v.shopifyVariantId, variantId)) ||
      (sku && v.sku === sku)
  );
  return variant ? { product, variant } : null;
}

/**
 * Pushes the ABSOLUTE post-write count back to Shopify (D-01/D-06). Never fails
 * the ack: on error the variant is flagged syncPending:true for the reconcile
 * pass (D-05) and the error is logged.
 */
async function pushBackAbsolute(productId, variantSku, inventoryItemId, absoluteQuantity) {
  try {
    await pushInventory(inventoryItemId, absoluteQuantity);
  } catch (err) {
    console.error(
      `Shopify pushInventory failed for ${variantSku} (${inventoryItemId}); marking syncPending:`,
      err.message
    );
    await Product.updateOne(
      { _id: productId, 'variants.sku': variantSku },
      { $set: { 'variants.$.syncPending': true } }
    );
  }
}

/**
 * Restocks one variant by SKU (versioned $inc UP — the reverse of the deduct,
 * D-07) and pushes the resulting ABSOLUTE count back. A pure increment is
 * atomically safe without a version guard, but the version is still bumped so
 * the optimistic-lock counter tracks every stock change. Never fails the ack.
 */
async function restockBySku(productId, variantSku, quantity) {
  const updated = await Product.findOneAndUpdate(
    { _id: productId, 'variants.sku': variantSku },
    { $inc: { 'variants.$.stock': quantity, 'variants.$.version': 1 } },
    { new: true }
  );
  if (!updated) {
    console.error(`Shopify restock: no variant ${variantSku} on product ${productId}`);
    return;
  }
  const variant = updated.variants.find((v) => v.sku === variantSku);
  await pushBackAbsolute(productId, variantSku, variant.shopifyInventoryItemId, variant.stock);
}

/**
 * Shared reversal handler for orders/cancelled and refunds/create (D-07).
 *
 * Idempotency (T-07-04): the reversal is gated by an ATOMIC Order status
 * transition paid -> failed. Only the FIRST delivery finds a `paid` order to
 * flip; a replay (or a reversal for an order we never deducted) finds nothing
 * and safely no-ops — no double-restock. This deliberately mirrors webhooks.js's
 * pending->paid transition gate, reusing the Order document as the reversal
 * ledger rather than inventing a separate idempotency store.
 *
 * @param {(payload, order) => Array<{productId,variantSku,quantity}>} resolveItems
 */
async function handleReversal(req, res, resolveOrderNumber, resolveItems) {
  if (!isAuthentic(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch (err) {
    console.error('Shopify reversal webhook: malformed JSON body, acking:', err.message);
    return res.status(200).json({ received: true });
  }

  try {
    const orderNumber = resolveOrderNumber(payload);

    // Atomic idempotency gate: flip the previously-deducted order to failed.
    const order = await Order.findOneAndUpdate(
      { orderNumber, status: 'paid' },
      { $set: { status: 'failed' } },
      { new: true }
    );

    if (!order) {
      // Already reversed (replay) or never deducted here — safe no-op.
      return res.status(200).json({ received: true, duplicate: true });
    }

    const restockItems = await resolveItems(payload, order);
    for (const item of restockItems) {
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) continue;
      await restockBySku(item.productId, item.variantSku, quantity);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    // Transient DB error — surface non-200 so Shopify's ~48h retry (D-05) works.
    console.error('Shopify reversal webhook processing error:', err);
    return res.status(500).json({ error: 'processing_failed' });
  }
}

// ---------------------------------------------------------------------------
// orders/paid — deduct + Order audit + push-back (D-07 / D-17)
// ---------------------------------------------------------------------------

router.post('/orders-paid', rawJson, async (req, res) => {
  // T-07-01: HMAC gate FIRST — zero DB access before this passes.
  if (!isAuthentic(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch (err) {
    // Malformed body — ack 200 so Shopify does not retry-storm a logic error.
    console.error('Shopify orders/paid: malformed JSON body, acking:', err.message);
    return res.status(200).json({ received: true });
  }

  try {
    const orderNumber = String(payload.id);

    // T-07-04 idempotency gate: the Order carries Shopify's own order id as its
    // unique orderNumber. A replay finds the existing audit and no-ops — no
    // second deduct, no duplicate Order. (The unique index on orderNumber is
    // the atomic backstop if two identical deliveries race this check.)
    const existing = await Order.findOne({ orderNumber });
    if (existing) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
    const items = [];
    const pushes = [];

    for (const lineItem of lineItems) {
      const quantity = Number(lineItem.quantity) || 0;
      if (quantity <= 0) continue;

      const match = await matchVariant(lineItem);
      if (!match) {
        // Unknown id/SKU (T-07-12): ack + log, never crash, never retry-storm.
        console.error(
          `Shopify orders/paid: no Mongo variant for variant_id=${lineItem.variant_id} sku=${lineItem.sku} (order ${orderNumber})`
        );
        continue;
      }

      const { product, variant } = match;
      const stockBefore = variant.stock;
      let stockAfter = stockBefore;

      // D-17 optimistic-lock deduct: $elemMatch on the version we read PLUS a
      // stock>=quantity floor so an oversell can never drive stock negative and
      // simply no-ops (shortfall) instead of throwing — the versioned $inc keeps
      // it concurrency-safe against a simultaneous POS deduct.
      const updated = await Product.findOneAndUpdate(
        {
          _id: product._id,
          variants: {
            $elemMatch: { sku: variant.sku, version: variant.version, stock: { $gte: quantity } },
          },
        },
        { $inc: { 'variants.$.stock': -quantity, 'variants.$.version': 1 } },
        { new: true }
      );

      if (updated) {
        const updatedVariant = updated.variants.find((v) => v.sku === variant.sku);
        stockAfter = updatedVariant.stock;
        pushes.push(
          pushBackAbsolute(product._id, variant.sku, variant.shopifyInventoryItemId, stockAfter)
        );
      } else {
        // Shortfall or version conflict: leave stock untouched (non-negative),
        // record the item at its pre-deduct level, log for reconciliation.
        console.error(
          `Shopify orders/paid: shortfall/conflict for sku=${variant.sku} qty=${quantity} (order ${orderNumber}); stock left at ${stockBefore}`
        );
      }

      items.push({
        productId: product._id,
        variantSku: variant.sku,
        name: product.name,
        quantity,
        priceAtPurchase: Number(lineItem.price) || 0,
        stockBefore,
        stockAfter,
      });
    }

    // One Order audit record (D-17). orderNumber = Shopify order id (unique-safe,
    // never Date.now()); source 'online'; NO shippingAddress (Shopify owns it,
    // Pitfall 2). Only write it when at least one line item resolved.
    if (items.length > 0) {
      const totalAmount =
        payload.total_price != null
          ? Number(payload.total_price)
          : items.reduce((sum, it) => sum + it.priceAtPurchase * it.quantity, 0);

      await Order.create({
        orderNumber,
        customerEmail: payload.email || 'shopify-import@unknown.local',
        customerName: payload.customer
          ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim()
          : undefined,
        items,
        totalAmount,
        status: 'paid',
        source: 'online',
      });
    }

    // Await the outbound pushes so a mid-flight failure flips syncPending before
    // we ack (they never reject — pushBackAbsolute swallows + flags).
    await Promise.all(pushes);

    return res.status(200).json({ received: true });
  } catch (err) {
    // Transient DB error: surface non-200 so Shopify's ~48h retry (D-05) does
    // useful work. (Malformed/unknown payloads were already handled above with
    // a 200 — only genuine infrastructure errors reach here.)
    console.error('Shopify orders/paid processing error:', err);
    return res.status(500).json({ error: 'processing_failed' });
  }
});

// ---------------------------------------------------------------------------
// orders/cancelled — restock the whole order (D-07)
// ---------------------------------------------------------------------------

router.post('/orders-cancelled', rawJson, (req, res) =>
  handleReversal(
    req,
    res,
    // orders/cancelled body IS the order object; its id is the order id.
    (payload) => String(payload.id),
    // Restock exactly what we deducted, from the stored Order audit's items
    // (reliable productId + variantSku + quantity — no re-matching needed).
    (_payload, order) =>
      order.items.map((it) => ({
        productId: it.productId,
        variantSku: it.variantSku,
        quantity: it.quantity,
      }))
  )
);

// ---------------------------------------------------------------------------
// refunds/create — restock the refunded quantities (D-07)
// ---------------------------------------------------------------------------

router.post('/refunds-create', rawJson, (req, res) =>
  handleReversal(
    req,
    res,
    // refunds/create carries the parent order id in order_id.
    (payload) => String(payload.order_id),
    // Restock only the refunded line quantities, matched to Mongo variants by
    // stored shopifyVariantId (SKU fallback), per refund_line_items.
    async (payload) => {
      const refundLines = Array.isArray(payload.refund_line_items)
        ? payload.refund_line_items
        : [];
      const items = [];
      for (const line of refundLines) {
        const lineItem = line.line_item || {};
        const match = await matchVariant(lineItem);
        if (!match) {
          console.error(
            `Shopify refunds/create: no Mongo variant for variant_id=${lineItem.variant_id} sku=${lineItem.sku}`
          );
          continue;
        }
        items.push({
          productId: match.product._id,
          variantSku: match.variant.sku,
          quantity: line.quantity,
        });
      }
      return items;
    }
  )
);

module.exports = router;
