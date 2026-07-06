'use strict';

/**
 * Payment provider webhook routes (Phase 06-06, AUTH-03 / D-07 / D-08 / D-09 /
 * D-10 / D-13 / D-14).
 *
 * Mounted in api/index.js BEFORE the global express.json() -- each route below
 * scopes express.raw({ type: 'application/json' }) so req.body is the exact,
 * unparsed byte buffer Stripe/PayPal signed. Signature verification MUST run
 * first, before any Order/Product read/write, so a forged event never
 * touches the database (T-06-01).
 *
 * fulfillOrder() is the single, shared idempotent side-effect path for both
 * providers (T-06-03/D-10): the atomic Order.findOneAndUpdate({status:
 * 'pending'}) transition IS the idempotency gate -- a replayed/duplicate
 * webhook delivery finds no pending document to match and safely no-ops.
 *
 * Stock deduction is a GUARDED atomic $inc (T-06-13/D-08): this is the ONLINE
 * channel, which must never go negative, but -- unlike inventory.js's /deduct
 * -- must never reject the webhook either (the payment is already captured).
 * It borrows inventory.js's $elemMatch floor-guard SHAPE but drops the
 * 409-reject and version guard; it does NOT copy sales.js's bare
 * allow-negative $inc (that is POS-only, per D-08).
 */

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { verifyStripeEvent } = require('../services/stripeClient');
const { verifyPaypalWebhook } = require('../services/paypalClient');
const { sendOrderConfirmation, sendBandNotification } = require('../services/email');

/**
 * Atomically flips a pending Order to paid, deducts stock per line with a
 * guarded (never-negative, never-rejecting) $inc, and fires both Resend
 * emails (D-13/D-14). Shared by both provider webhook handlers so there is
 * exactly one atomic-transition/$inc/email code path.
 *
 * Safe to call repeatedly with the same orderNumber -- only the FIRST call
 * (per order) finds a `pending` document to match; every subsequent call
 * (replay/duplicate delivery) is a no-op.
 *
 * @param {string} orderNumber
 * @param {string} paymentIntentId - provider payment/capture id, persisted onto the Order.
 */
async function fulfillOrder(orderNumber, paymentIntentId) {
  if (!orderNumber) {
    console.error('Webhook fulfillment skipped: no orderNumber on the event');
    return;
  }

  const order = await Order.findOneAndUpdate(
    { orderNumber, status: 'pending' },
    { $set: { status: 'paid', paymentIntentId, paidAt: new Date() } },
    { new: true }
  );

  if (!order) {
    // Already processed (replay/duplicate delivery) or unknown order -- safe no-op.
    return;
  }

  let hadShortfall = false;

  for (const item of order.items) {
    // Online stock must NEVER go negative (D-08) -- guard on stock >= quantity
    // in the same atomic update. Race-safe: a concurrent last-unit buyer
    // cannot drive it below 0. NOT sales.js's bare $inc (POS allow-negative);
    // NOT inventory.js's 409-reject (payment already captured, never fail).
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        variants: { $elemMatch: { sku: item.variantSku, stock: { $gte: item.quantity } } },
      },
      { $inc: { 'variants.$.stock': -item.quantity } },
      { new: true }
    );

    if (updatedProduct) {
      const updatedVariant = updatedProduct.variants.find((v) => v.sku === item.variantSku);
      item.stockAfter = updatedVariant.stock; // always >= 0, satisfies Order model's min:0
    } else {
      // Insufficient stock at fulfillment time (concurrent last-unit race).
      // Payment is already captured -- do NOT go negative, do NOT reject.
      item.stockAfter = item.stockBefore;
      hadShortfall = true; // surfaced in the band-notification email for manual reconciliation
    }
  }

  await order.save();

  // WR-02 — send independently via Promise.allSettled so a failure on one
  // (e.g. Resend rejects the customer's address) can never suppress the
  // other. Neither failure should reject fulfillOrder: the payment is
  // already captured and stock already deducted, so the caller must still
  // ack the webhook 200 -- a rejected email here is only logged for manual
  // follow-up, never retried via a provider retry-storm.
  const emailResults = await Promise.allSettled([
    sendOrderConfirmation(order),
    sendBandNotification(order, { shortfall: hadShortfall }),
  ]);
  for (const result of emailResults) {
    if (result.status === 'rejected') {
      console.error('Order fulfillment email failed:', result.reason);
    }
  }
}

/**
 * POST /api/webhooks/stripe
 * Verifies the Stripe signature FIRST (zero DB access before verification).
 * On checkout.session.completed with payment_status 'paid', fulfills the
 * Order matched by client_reference_id (fallback metadata.orderNumber).
 * Always acks 200 once the event is accepted -- the payment is already
 * captured, so a fulfillment-side bug must not trigger a Stripe retry storm.
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = verifyStripeEvent(req.body, req.headers['stripe-signature']);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const orderNumber = session.client_reference_id || session.metadata?.orderNumber;
        await fulfillOrder(orderNumber, session.payment_intent ?? session.id);
      }
    }
  } catch (error) {
    console.error('Stripe webhook fulfillment error:', error);
    // Still ack 200 below -- payment already captured, must not retry-storm
    // Stripe over a fulfillment-side bug; logged here for investigation.
  }

  return res.status(200).json({ received: true });
});

/**
 * POST /api/webhooks/paypal
 * Verifies the PayPal transmission signature FIRST (zero DB access before
 * verification). On a verified PAYMENT.CAPTURE.COMPLETED event, fulfills the
 * Order matched by the capture resource's custom_id. Reuses fulfillOrder --
 * no duplicated atomic-transition/$inc/email logic.
 */
router.post('/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBodyString = req.body.toString();

  let verified;
  try {
    verified = await verifyPaypalWebhook(req.headers, rawBodyString);
  } catch (error) {
    console.error('PayPal webhook verification error:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (!verified) {
    console.error('PayPal webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const event = JSON.parse(rawBodyString);
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = event.resource || {};
      const orderNumber = resource.custom_id;
      await fulfillOrder(orderNumber, resource.id);
    }
  } catch (error) {
    console.error('PayPal webhook fulfillment error:', error);
    // Still ack 200 below -- payment already captured, must not retry-storm
    // PayPal over a fulfillment-side bug; logged here for investigation.
  }

  return res.status(200).json({ received: true });
});

module.exports = router;
