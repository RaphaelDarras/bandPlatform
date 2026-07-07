'use strict';

/**
 * Stripe service singleton (Phase 06-03, D-02 hosted Checkout, D-06 server prices).
 *
 * This file only talks to Stripe — it does NOT deduct stock or send email
 * (that happens in the webhook handler per D-07/D-14, keeping a single
 * source of truth).
 */

const Stripe = require('stripe');
const { toStripeMinorUnits } = require('./amounts');

// Lazy singleton: the Stripe SDK throws ("Neither apiKey nor
// config.authenticator provided") the instant it is constructed without a
// key. Constructing at module load would crash the ENTIRE api at boot
// (index.js requires the orders + webhooks routes, which require this file)
// whenever STRIPE_SECRET_KEY is unset — taking down every unrelated route and
// failing the deploy. Defer construction to first use so the server boots and
// only the checkout path errors cleanly until the key is configured.
let _stripe;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

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
  const session = await getStripe().checkout.sessions.create({
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
  return getStripe().webhooks.constructEvent(rawBody, signatureHeader, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckoutSession, verifyStripeEvent };
