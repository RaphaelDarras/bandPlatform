'use strict';

/**
 * Unit tests for shopifyWebhookAuth.verifyShopifyWebhook (Phase 07-04, T-07-01).
 *
 * Proves the timing-safe HMAC gate that guards every inbound Shopify webhook:
 * true only for a signature computed with the same secret over the same raw
 * bytes; false (never a throw) for a tampered body, a wrong secret, or a
 * missing/empty/length-mismatched header.
 */

const crypto = require('crypto');
const { verifyShopifyWebhook } = require('../services/shopifyWebhookAuth');

const SECRET = 'test-client-secret';
const RAW_BODY = Buffer.from(JSON.stringify({ id: 12345, financial_status: 'paid' }), 'utf8');

function signWith(secret, buf) {
  return crypto.createHmac('sha256', secret).update(buf).digest('base64');
}

describe('verifyShopifyWebhook', () => {
  it('returns true for a signature computed with the same secret over the same bytes', () => {
    const hmac = signWith(SECRET, RAW_BODY);
    expect(verifyShopifyWebhook(RAW_BODY, hmac, SECRET)).toBe(true);
  });

  it('returns false for a tampered body', () => {
    const hmac = signWith(SECRET, RAW_BODY);
    const tampered = Buffer.from(JSON.stringify({ id: 12345, financial_status: 'refunded' }), 'utf8');
    expect(verifyShopifyWebhook(tampered, hmac, SECRET)).toBe(false);
  });

  it('returns false when the signature was made with a different secret', () => {
    const forged = signWith('wrong-secret', RAW_BODY);
    expect(verifyShopifyWebhook(RAW_BODY, forged, SECRET)).toBe(false);
  });

  it('returns false (no throw) for a missing / empty / undefined header', () => {
    expect(verifyShopifyWebhook(RAW_BODY, '', SECRET)).toBe(false);
    expect(verifyShopifyWebhook(RAW_BODY, undefined, SECRET)).toBe(false);
    expect(verifyShopifyWebhook(RAW_BODY, null, SECRET)).toBe(false);
  });

  it('returns false (no throw) when the header is a valid base64 but wrong length', () => {
    // A short, length-mismatched base64 digest must not throw in timingSafeEqual.
    expect(() => verifyShopifyWebhook(RAW_BODY, 'YWJj', SECRET)).not.toThrow();
    expect(verifyShopifyWebhook(RAW_BODY, 'YWJj', SECRET)).toBe(false);
  });
});
