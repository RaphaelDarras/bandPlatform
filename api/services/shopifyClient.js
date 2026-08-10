'use strict';

/**
 * Shopify Admin GraphQL client wrapper (Phase 07-04, RESEARCH Pattern 3).
 *
 * The single authenticated, error-surfacing entry point for every outbound
 * Admin API call. It wraps @shopify/admin-api-client with the token cache so
 * each request always carries a fresh, auto-refreshed access token
 * (shopifyTokenCache.getAccessToken) — no static token env var (D-16, Pitfall 1).
 *
 * CONFIRMED CJS access path (07-01): require('@shopify/admin-api-client')
 * exposes createAdminApiClient directly at the top level — no `.default`.
 *
 * Boot-safe: env vars are read only inside shopifyRequest(), so a missing
 * SHOPIFY_SHOP_DOMAIN / SHOPIFY_API_VERSION never crashes the API at boot
 * (threat T-07-09).
 */

const { createAdminApiClient } = require('@shopify/admin-api-client');
const { getAccessToken } = require('./shopifyTokenCache');

/**
 * Sends an authenticated GraphQL request to the Shopify Admin API.
 * Surfaces any GraphQL-level `errors` as a thrown Error so callers can convert
 * them to an HTTP status (thin "let it throw" wrapper, mirrors paypalClient.js).
 *
 * @param {string} query - the GraphQL query/mutation document.
 * @param {object} [variables] - GraphQL variables.
 * @returns {Promise<object>} the `data` payload on success.
 * @throws if the response carries `errors`, or the token exchange fails.
 */
async function shopifyRequest(query, variables) {
  const accessToken = await getAccessToken();
  const client = createAdminApiClient({
    storeDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    apiVersion: process.env.SHOPIFY_API_VERSION,
    accessToken,
  });

  const { data, errors } = await client.request(query, { variables });
  if (errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(errors)}`);
  }
  return data;
}

module.exports = { shopifyRequest };
