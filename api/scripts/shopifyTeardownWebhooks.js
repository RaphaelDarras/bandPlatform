'use strict';

/**
 * One-off cutover tool for 07.1 (plan 14): lists and (with --apply) deletes the
 * Phase 7 Shopify webhook subscriptions whose callbackUrl contains
 * /api/shopify/webhooks/. Dry run by default. Self-contained (no api/services
 * imports). Safe to delete after use.
 *
 * Usage: node api/scripts/shopifyTeardownWebhooks.js [--apply]
 */

const path = require('path');

const PHASE7_PATH = '/api/shopify/webhooks/';

function callbackUrlOf(sub) {
  if (!sub) return '';
  if (typeof sub.callbackUrl === 'string') return sub.callbackUrl;
  if (sub.endpoint && typeof sub.endpoint.callbackUrl === 'string') return sub.endpoint.callbackUrl;
  return '';
}

function selectPhase7Webhooks(subscriptions) {
  return (subscriptions || []).filter((s) => callbackUrlOf(s).includes(PHASE7_PATH));
}

const LIST_QUERY = `
  query {
    webhookSubscriptions(first: 100) {
      edges {
        node {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint { callbackUrl }
          }
        }
      }
    }
  }
`;

const DELETE_MUTATION = `
  mutation webhookSubscriptionDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors { field message }
    }
  }
`;

async function getToken(shop) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);
  const body = await res.json();
  return body.access_token;
}

async function gql(shop, version, token, query, variables) {
  const res = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify request failed (HTTP ${res.status})`);
  const body = await res.json();
  if (body.errors) throw new Error('Shopify GraphQL returned errors');
  return body.data;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const apply = process.argv.includes('--apply');
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const version = process.env.SHOPIFY_API_VERSION;
  if (!shop || !version || !process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) {
    throw new Error('Missing SHOPIFY_SHOP_DOMAIN / SHOPIFY_API_VERSION / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET');
  }
  const token = await getToken(shop);
  const data = await gql(shop, version, token, LIST_QUERY);
  const subs = data.webhookSubscriptions.edges.map((e) => e.node);
  const matched = selectPhase7Webhooks(subs);
  for (const s of matched) console.log(`${s.topic} ${s.id} ${callbackUrlOf(s)}`);
  if (matched.length === 0) console.log('No Phase 7 webhook subscriptions found.');
  if (!apply) {
    console.log('dry run — re-run with --apply to delete');
    return;
  }
  let failed = false;
  for (const s of matched) {
    const out = await gql(shop, version, token, DELETE_MUTATION, { id: s.id });
    const r = out.webhookSubscriptionDelete;
    if (r.userErrors && r.userErrors.length) {
      failed = true;
      console.error(`FAILED ${s.id}: ${r.userErrors.map((u) => u.message).join('; ')}`);
    } else {
      console.log(`deleted ${r.deletedWebhookSubscriptionId}`);
    }
  }
  if (failed) process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { selectPhase7Webhooks };
