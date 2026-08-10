'use strict';

/**
 * Shopify webhook HMAC verification (Phase 07-04, RESEARCH Pattern 7, T-07-01).
 *
 * The security gate for every inbound Shopify webhook: identity is proven only
 * by an HMAC-SHA256 over the RAW, unparsed request body keyed by the app's
 * Client Secret, sent in the `X-Shopify-Hmac-SHA256` header. The route handler
 * (plan 07-06) must call this FIRST and return 401 with zero DB access on false.
 *
 * The digest comparison uses crypto.timingSafeEqual (never `===`) to avoid a
 * timing side channel. timingSafeEqual throws on unequal-length buffers, so we
 * guard the lengths first and return false rather than throwing on any
 * mismatch, empty, or malformed header.
 */

const crypto = require('crypto');

/**
 * Verifies a Shopify webhook signature.
 *
 * @param {Buffer} rawBodyBuffer - the exact, unparsed request body bytes.
 * @param {string} hmacHeader - the base64 `X-Shopify-Hmac-SHA256` header value.
 * @param {string} clientSecret - the app Client Secret used as the HMAC key.
 * @returns {boolean} true only for a valid signature; false on any mismatch.
 */
function verifyShopifyWebhook(rawBodyBuffer, hmacHeader, clientSecret) {
  if (!hmacHeader) {
    return false;
  }

  const digest = crypto.createHmac('sha256', clientSecret).update(rawBodyBuffer).digest('base64');

  const digestBuf = Buffer.from(digest);
  const headerBuf = Buffer.from(hmacHeader);

  // timingSafeEqual throws on unequal length — guard first so a malformed
  // header returns false instead of throwing.
  if (digestBuf.length !== headerBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuf, headerBuf);
}

module.exports = { verifyShopifyWebhook };
