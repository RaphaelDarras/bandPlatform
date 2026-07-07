'use strict';

/**
 * PayPal service singleton (Phase 06-03, D-02 hosted approve flow, D-06 server
 * prices, Pitfall 4 explicit capture).
 *
 * Uses the CONFIRMED CJS require() access path from 06-01-SUMMARY.md:
 * require('@paypal/paypal-server-sdk') exposes Client, OrdersController,
 * Environment, CheckoutPaymentIntent directly at the top level -- no
 * `.default` interop wrapper needed.
 *
 * amount.value MUST always come from toPaypalAmountString (decimal string,
 * e.g. "19.99") -- NEVER the Stripe integer-minor-units helper from
 * ./amounts. Mixing the two conventions causes a 100x mischarge
 * (RESEARCH Pitfall 2 / threat T-06-08).
 */

const { Client, Environment, CheckoutPaymentIntent, OrdersController } = require('@paypal/paypal-server-sdk');
const { toPaypalAmountString } = require('./amounts');

// Lazy singleton (mirrors stripeClient.js): defer client construction to first
// use so a missing PAYPAL_CLIENT_ID/SECRET never crashes the api at boot. Only
// the PayPal checkout/capture path errors cleanly until credentials exist.
let _ordersController;
function getOrdersController() {
  if (!_ordersController) {
    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
      },
      environment: process.env.PAYPAL_ENV === 'live' ? Environment.Production : Environment.Sandbox,
    });
    _ordersController = new OrdersController(client);
  }
  return _ordersController;
}

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

/**
 * Creates a PayPal Order (Orders v2, intent CAPTURE) for a pending Order.
 * amount.value uses toPaypalAmountString -- a decimal string, never an
 * integer (Pitfall 2). Returns the approve link so the caller can redirect
 * the browser, mirroring stripeClient.createCheckoutSession's { url } shape.
 *
 * @param {object} order - pending Order document (or plain object) with
 *   orderNumber, totalAmount.
 * @returns {Promise<{ id: string, approveUrl: string }>}
 */
async function createPaypalOrder(order) {
  const { result } = await getOrdersController().createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          customId: order.orderNumber,
          amount: {
            currencyCode: 'EUR',
            value: toPaypalAmountString(order.totalAmount),
          },
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            returnUrl: `${process.env.WEB_BASE_URL}/checkout/paypal-return?order=${order.orderNumber}`,
            cancelUrl: `${process.env.WEB_BASE_URL}/checkout/cancel`,
            userAction: 'PAY_NOW',
          },
        },
      },
    },
  });

  const approveUrl = result.links.find((l) => l.rel === 'approve').href;
  return { id: result.id, approveUrl };
}

/**
 * Captures a previously-approved PayPal Order (explicit capture step --
 * approval alone does NOT move money, RESEARCH Pitfall 4).
 *
 * @param {string} paypalOrderId
 * @returns {Promise<object>} the capture result (status COMPLETED on success).
 */
async function capturePaypalOrder(paypalOrderId) {
  const { result } = await getOrdersController().captureOrder({ id: paypalOrderId });
  return result;
}

/**
 * Obtains a client-credentials OAuth access token for direct REST calls
 * (the SDK does not expose a webhooks controller in this version).
 */
async function getAccessToken() {
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  return data.access_token;
}

/**
 * Verifies a PayPal webhook by POSTing the transmission headers + the
 * (untouched) webhook_event JSON to PayPal's own verify-webhook-signature
 * endpoint -- RESEARCH's recommended default over local CRC32/RSA
 * self-verification (simpler, far less error-prone for a DIY/spare-time
 * project).
 *
 * @param {object} headers - request headers (paypal-transmission-id,
 *   paypal-transmission-time, paypal-transmission-sig, paypal-cert-url,
 *   paypal-auth-algo).
 * @param {string} rawBodyString - the raw request body as a string, parsed
 *   into JSON only here (after being received as a Buffer upstream).
 * @returns {Promise<boolean>} true only when verification_status === 'SUCCESS'.
 */
async function verifyPaypalWebhook(headers, rawBodyString) {
  const accessToken = await getAccessToken();
  const webhookEvent = JSON.parse(rawBodyString);

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      transmission_sig: headers['paypal-transmission-sig'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent,
    }),
  });

  const result = await response.json();
  return result.verification_status === 'SUCCESS';
}

module.exports = { createPaypalOrder, capturePaypalOrder, verifyPaypalWebhook };
