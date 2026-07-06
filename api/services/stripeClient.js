'use strict';

/**
 * Stripe service singleton (Phase 06-03, D-02 hosted Checkout, D-06 server prices).
 *
 * This file only talks to Stripe — it does NOT deduct stock or send email
 * (that happens in the webhook handler per D-07/D-14, keeping a single
 * source of truth).
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { toStripeMinorUnits } = require('./amounts');

/**
 * Creates a hosted Stripe Checkout Session for a pending Order.
 * line_items are built server-side from order.items (never trust a client
 * unit price — D-06); order.items entries are expected to carry
 * { name, priceAtPurchase, quantity } (the Order model's item snapshot).
 *
 * @param {object} order - pending Order document (or plain object) with
 *   items[], orderNumber.
 * @returns {Promise<{ url: string, paymentIntentId: string }>}
 */
async function createCheckoutSession(order) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: order.items.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: item.name },
        unit_amount: toStripeMinorUnits(item.priceAtPurchase),
      },
      quantity: item.quantity,
    })),
    client_reference_id: order.orderNumber,
    metadata: { orderNumber: order.orderNumber },
    success_url: `${process.env.WEB_BASE_URL}/checkout/success?order=${order.orderNumber}`,
    cancel_url: `${process.env.WEB_BASE_URL}/checkout/cancel`,
  });

  return { url: session.url, paymentIntentId: session.payment_intent ?? session.id };
}

/**
 * Verifies a Stripe webhook signature and returns the constructed event.
 * Lets stripe.webhooks.constructEvent throw on a bad/tampered signature —
 * the caller (webhooks route) is responsible for converting that into a 4xx.
 *
 * @param {Buffer|string} rawBody - the exact, unparsed request body bytes.
 * @param {string} signatureHeader - the `stripe-signature` request header.
 * @returns {import('stripe').Stripe.Event}
 */
function verifyStripeEvent(rawBody, signatureHeader) {
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckoutSession, verifyStripeEvent };
