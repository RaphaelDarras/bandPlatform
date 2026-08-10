'use strict';

/**
 * Shopify Admin API token cache (Phase 07-04, D-16 intent / RESEARCH Pattern 2).
 *
 * Post-2026 custom apps no longer ship a static Admin API token. Instead we
 * exchange the app's Client ID + Client Secret for a short-lived (~24h,
 * expires_in: 86399) access token via the client-credentials grant, cache it
 * in-process, and proactively refresh 5 minutes before expiry.
 *
 * Lazy/never-at-boot (mirrors stripeClient.js / paypalClient.js): the env vars
 * are read only inside getAccessToken(), so a missing SHOPIFY_CLIENT_ID /
 * SHOPIFY_CLIENT_SECRET / SHOPIFY_SHOP_DOMAIN breaks ONLY the sync path at call
 * time — it never crashes the API at require() time (threat T-07-09).
 *
 * Secrets are read straight from process.env inside the function body and are
 * NEVER logged or destructured to a logged variable (threat T-07-02).
 */

// Proactive refresh margin: refetch once we are within 5 minutes of expiry so
// an in-flight request never races a mid-flight token expiry.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Module-level singleton: { token, expiresAt } | null. Resets on cold start
// (Render free tier spins down) — the module simply re-exchanges on first use.
let cached = null;

/**
 * Returns a valid Admin API access token, minting or refreshing as needed.
 *
 * @returns {Promise<string>} a short-lived Admin API access token.
 * @throws if the required env vars are unset, or the token exchange is not ok.
 */
async function getAccessToken() {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.token;
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shopDomain || !clientId || !clientSecret) {
    throw new Error(
      'Shopify is not configured (SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET required)',
    );
  }

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    // Do not cache a bad token; surface the HTTP status only (never the secret).
    throw new Error(`Shopify token exchange failed: ${res.status}`);
  }

  const body = await res.json(); // { access_token, scope, expires_in: 86399 }
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return cached.token;
}

/**
 * Test-only: clears the in-process token cache so each test starts cold.
 */
function _resetCache() {
  cached = null;
}

module.exports = { getAccessToken, _resetCache };
