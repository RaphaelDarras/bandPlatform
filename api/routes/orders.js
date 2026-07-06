'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { createOrderWithUniqueNumber } = require('../services/orderNumber');
const { createCheckoutSession } = require('../services/stripeClient');
const { createPaypalOrder, capturePaypalOrder } = require('../services/paypalClient');

// Public guest checkout — NO authenticateToken (mirrors products.js's public
// GET routes). Anonymous customers have no JWT.

// Server-side maxLength bounds (V5), mirroring the client-side maxLength
// attributes already enforced in web/src/pages/Checkout.tsx (T-5-15) —
// re-validated here since the client bound is trivially bypassable (T-06-11).
const MAX_LENGTHS = {
  customerEmail: 254,
  customerName: 100,
  addressLine1: 200,
  addressLine2: 200,
  city: 100,
  postalCode: 20,
  country: 56,
};

function tooLong(value, field) {
  return typeof value === 'string' && value.length > MAX_LENGTHS[field];
}

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a guest order (checkout)
 *     description: |
 *       Public, unauthenticated guest checkout. Recomputes every line price
 *       server-side from Product.basePrice + variant.priceAdjustment (D-06 —
 *       the client-supplied unitPrice is never trusted), snapshots
 *       stockBefore WITHOUT deducting (D-05/D-07 — deduction happens only on
 *       the verified paid webhook), creates a pending Order, then creates
 *       the chosen provider's hosted session and returns a redirect URL.
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *     responses:
 *       201:
 *         description: Pending order created; redirect the browser to redirectUrl
 *       400:
 *         description: Validation error (missing fields, unknown product/variant, insufficient stock)
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req, res) => {
  try {
    const { customerEmail, customerName, items, shippingAddress, paymentMethod } = req.body;

    if (!customerEmail || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
      return res.status(400).json({ error: 'customerEmail, items, and shippingAddress are required' });
    }

    if (!['stripe', 'paypal'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be either "stripe" or "paypal"' });
    }

    if (tooLong(customerEmail, 'customerEmail') || tooLong(customerName, 'customerName')) {
      return res.status(400).json({ error: 'customerEmail or customerName exceeds maximum length' });
    }

    const { addressLine1, addressLine2, city, postalCode, country } = shippingAddress;
    if (!addressLine1 || !city || !postalCode || !country) {
      return res.status(400).json({ error: 'shippingAddress is missing required fields' });
    }
    if (
      tooLong(addressLine1, 'addressLine1') ||
      tooLong(addressLine2, 'addressLine2') ||
      tooLong(city, 'city') ||
      tooLong(postalCode, 'postalCode') ||
      tooLong(country, 'country')
    ) {
      return res.status(400).json({ error: 'shippingAddress field exceeds maximum length' });
    }

    // Resolve each line item against the live catalog. NEVER read
    // item.unitPrice from the client (D-06) — priceAtPurchase is always
    // recomputed from Product.basePrice + variant.priceAdjustment.
    // Each resolvedItems entry also carries `name` (Product.name at
    // purchase time, CR-01) so it's persisted on the Order and available to
    // both stripeClient.createCheckoutSession's product_data.name and
    // email.js's renderItemsRows() — no separate parallel array needed.
    const resolvedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const { productId, variantSku, quantity } = item;

      // WR-07 — validate the shape up front so a malformed productId (e.g.
      // not a 24-char hex ObjectId string) returns a clean 400 instead of
      // Product.findById throwing an uncaught Mongoose CastError that falls
      // through to the outer catch's generic 500.
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ error: `Invalid productId ${productId}` });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ error: `Unknown product ${productId}` });
      }

      const variant = product.variants.find((v) => v.sku === variantSku);
      if (!variant) {
        return res.status(400).json({ error: `Unknown variant ${variantSku}` });
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: `Invalid quantity for ${variantSku}` });
      }

      // D-08 online guard #1 — never start payment for out-of-stock merch
      // (the webhook's guarded $inc decrement is guard #2).
      if (quantity > variant.stock) {
        return res.status(400).json({ error: `Insufficient stock for ${variantSku}` });
      }

      const priceAtPurchase = product.basePrice + variant.priceAdjustment;

      // WR-08 — defensive floor: Product.variants[].priceAdjustment has no
      // `min` constraint, so a variant configured with an adjustment more
      // negative than basePrice would otherwise only surface as an
      // unhandled Mongoose ValidationError (OrderItemSchema.priceAtPurchase
      // has min: 0) at createOrderWithUniqueNumber -> outer catch -> 500.
      if (priceAtPurchase < 0) {
        return res.status(400).json({ error: `Invalid price for ${variantSku}` });
      }

      const stockBefore = variant.stock;

      resolvedItems.push({
        productId,
        variantSku,
        name: product.name,
        quantity,
        priceAtPurchase,
        stockBefore,
        // Unchanged — deduction only happens on the paid webhook (D-07).
        stockAfter: stockBefore,
      });

      totalAmount += priceAtPurchase * quantity;
    }

    const order = await createOrderWithUniqueNumber(Order, {
      customerEmail,
      customerName,
      items: resolvedItems,
      totalAmount,
      shippingAddress: { addressLine1, addressLine2, city, postalCode, country },
      status: 'pending',
      source: 'online',
      paymentMethod,
    });

    // WR-03 — the pending Order is already persisted above. If the
    // provider-session step throws (Stripe/PayPal API error, network blip,
    // amount below the provider's minimum, etc.), mark the order `failed`
    // instead of leaving it orphaned in `pending` forever with no
    // paymentIntentId (no session/webhook will ever reference it, and a
    // retrying customer would otherwise pile up stale duplicates).
    let redirectUrl;
    try {
      if (paymentMethod === 'stripe') {
        const session = await createCheckoutSession({ orderNumber: order.orderNumber, items: resolvedItems });
        redirectUrl = session.url;
        order.paymentIntentId = session.paymentIntentId;
      } else {
        const paypalOrder = await createPaypalOrder(order);
        redirectUrl = paypalOrder.approveUrl;
        order.paymentIntentId = paypalOrder.id;
      }

      await order.save();
    } catch (providerError) {
      await Order.findByIdAndUpdate(order._id, { status: 'failed' });
      throw providerError;
    }

    return res.status(201).json({ orderNumber: order.orderNumber, redirectUrl });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/orders/paypal/capture:
 *   post:
 *     summary: Capture an approved PayPal order (return-flow)
 *     description: |
 *       Public, unauthenticated. Explicitly captures a previously-approved
 *       PayPal order (approval alone does not move money). Does NOT deduct
 *       stock, flip Order.status, or send email — those remain the sole
 *       responsibility of the webhook handler (D-07/D-09/D-14), keeping a
 *       single source of truth.
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Capture result
 *       400:
 *         description: paypalOrderId missing or capture failed
 */
router.post('/paypal/capture', async (req, res) => {
  try {
    const { paypalOrderId } = req.body;
    if (!paypalOrderId) {
      return res.status(400).json({ error: 'paypalOrderId is required' });
    }

    const result = await capturePaypalOrder(paypalOrderId);
    return res.status(200).json({ status: result.status });
  } catch (error) {
    console.error('Capture PayPal order error:', error);
    return res.status(400).json({ error: 'Failed to capture PayPal order' });
  }
});

module.exports = router;
