'use strict';

/**
 * Resend transactional email service (Phase 06-04, D-12/D-13/D-14/D-17).
 *
 * Two senders, both fired once per paid order from the webhook handler
 * (D-14) — never from the browser success redirect:
 *   - sendOrderConfirmation(order): the customer's de-facto receipt. MUST
 *     carry the exact French VAT-exemption mention (D-17, franchise en
 *     base de TVA, art. 293 B du CGI) since prices are all-inclusive with
 *     no separate VAT line.
 *   - sendBandNotification(order): interim fulfillment trigger (D-13) —
 *     the band has no /orders admin view until Phase 06.1, so this email
 *     is how they learn a paid order needs shipping. Shipping address is
 *     rendered prominently.
 *
 * Neither template embeds a tracking/analytics pixel — the platform's
 * no-tracking posture (Phase 5 Meta Pixel/CAPI removal) must not be
 * reintroduced via "read receipt" style tracking images.
 *
 * order.items entries carry a persisted `name` (product name snapshot,
 * CR-01) set by orders.js at order-creation time and stored on
 * OrderItemSchema — the same field stripeClient.js's createCheckoutSession
 * reads for product_data.name. renderItemsRows() still falls back to
 * variantSku defensively (e.g. for pre-CR-01 legacy documents).
 */

const { Resend } = require('resend');

// Lazy singleton (mirrors stripeClient.js / paypalClient.js): `new Resend()`
// throws ("Missing API key") when RESEND_API_KEY is unset, which would crash
// the entire api at boot (index.js → webhooks route → this file). Defer
// construction to first use so the server boots and only the email send path
// errors cleanly until the key is configured.
let _resend;
function getResend() {
  if (!_resend) {
    // `new Resend()` throws ("Missing API key") without RESEND_API_KEY, so this
    // is only reached on the actual send path — never at module load.
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_ADDRESS = 'Hurakan <noreply@hurakanband.fr>';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEur(amount) {
  return `€${Number(amount ?? 0).toFixed(2)}`;
}

function renderItemsRows(items) {
  return (items || [])
    .map((item) => {
      const label = escapeHtml(item.name || item.variantSku);
      return `<tr>
        <td style="padding:8px 0;color:#e5e5e5;">${label} &times; ${item.quantity}</td>
        <td style="padding:8px 0;color:#e5e5e5;text-align:right;">${formatEur(item.priceAtPurchase * item.quantity)}</td>
      </tr>`;
    })
    .join('');
}

function renderShippingAddressBlock(shippingAddress, { prominent } = {}) {
  const addr = shippingAddress || {};
  const size = prominent ? '18px' : '14px';
  return `<div style="margin:16px 0;padding:16px;background:#1a1a1a;border:1px solid #333;border-radius:4px;">
    <p style="margin:0 0 8px 0;color:#a855f7;font-size:${size};font-weight:bold;">Shipping address</p>
    <p style="margin:0;color:#e5e5e5;font-size:${size};line-height:1.5;">
      ${escapeHtml(addr.addressLine1)}<br/>
      ${addr.addressLine2 ? `${escapeHtml(addr.addressLine2)}<br/>` : ''}
      ${escapeHtml(addr.postalCode)} ${escapeHtml(addr.city)}<br/>
      ${escapeHtml(addr.country)}
    </p>
  </div>`;
}

function renderCustomerEmail(order) {
  return `<div style="background:#0d0d0d;padding:32px;font-family:sans-serif;">
    <h1 style="color:#a855f7;">Hurakan</h1>
    <p style="color:#e5e5e5;">Thanks for your order, ${escapeHtml(order.customerName || 'friend')}!</p>
    <p style="color:#e5e5e5;">Order <strong>${escapeHtml(order.orderNumber)}</strong> is confirmed. We'll ship it soon.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${renderItemsRows(order.items)}
      <tr>
        <td style="padding:12px 0 0 0;color:#ffffff;font-weight:bold;border-top:1px solid #333;">Total</td>
        <td style="padding:12px 0 0 0;color:#ffffff;font-weight:bold;text-align:right;border-top:1px solid #333;">${formatEur(order.totalAmount)}</td>
      </tr>
    </table>
    ${renderShippingAddressBlock(order.shippingAddress)}
    <p style="margin-top:24px;color:#888;font-size:12px;">TVA non applicable, art. 293 B du CGI</p>
  </div>`;
}

function renderBandNotificationEmail(order, { shortfall } = {}) {
  const shortfallNotice = shortfall
    ? `<p style="margin:0 0 16px 0;color:#f87171;font-weight:bold;">STOCK SHORTFALL — one or more items could not be fully deducted. Reconcile manually.</p>`
    : '';
  return `<div style="background:#0d0d0d;padding:32px;font-family:sans-serif;">
    <h1 style="color:#a855f7;">New paid order</h1>
    ${shortfallNotice}
    <p style="color:#e5e5e5;">Order <strong>${escapeHtml(order.orderNumber)}</strong> — ${escapeHtml(order.customerName || order.customerEmail)}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${renderItemsRows(order.items)}
      <tr>
        <td style="padding:12px 0 0 0;color:#ffffff;font-weight:bold;border-top:1px solid #333;">Total</td>
        <td style="padding:12px 0 0 0;color:#ffffff;font-weight:bold;text-align:right;border-top:1px solid #333;">${formatEur(order.totalAmount)}</td>
      </tr>
    </table>
    ${renderShippingAddressBlock(order.shippingAddress, { prominent: true })}
  </div>`;
}

/**
 * Sends the customer's order-confirmation email (their de-facto receipt).
 * @param {object} order - a paid Order document/plain object.
 * @returns {Promise<*>} resend.emails.send() result.
 */
async function sendOrderConfirmation(order) {
  return getResend().emails.send({
    from: FROM_ADDRESS,
    to: [order.customerEmail],
    subject: `Order confirmed — ${order.orderNumber}`,
    html: renderCustomerEmail(order),
  });
}

/**
 * Sends the band's internal new-order notification (interim fulfillment
 * trigger until Phase 06.1's /orders view exists, D-13).
 * @param {object} order - a paid Order document/plain object.
 * @param {{ shortfall?: boolean }} [options] - flags a stock-deduction
 *   guard-miss (D-08) for manual reconciliation.
 * @returns {Promise<*>} resend.emails.send() result.
 */
async function sendBandNotification(order, options = {}) {
  return getResend().emails.send({
    from: FROM_ADDRESS,
    to: [process.env.BAND_NOTIFICATION_EMAIL],
    subject: `New paid order — ${order.orderNumber} — ship to ${order.shippingAddress?.city ?? ''}`,
    html: renderBandNotificationEmail(order, options),
  });
}

module.exports = { sendOrderConfirmation, sendBandNotification, renderCustomerEmail, renderBandNotificationEmail };
