'use strict';

/**
 * One-time Shopify store setup (Phase 07-09, SHOP-18; D-07/D-16, RESEARCH
 * Pattern 6). Custom (single-store) apps have no CLI TOML config, so webhook
 * subscriptions and the pinned location are established per-shop via the Admin
 * GraphQL API.
 *
 * Two steps, both run once against the live store with production env vars:
 *   1. Query locations and print id + name so the operator can set the pinned
 *      SHOPIFY_LOCATION_ID (D-16 single-location pin).
 *   2. Register exactly the six D-07 webhook topics via webhookSubscriptionCreate,
 *      idempotently (existing subscriptions to the same URI are skipped, so a
 *      re-run never accumulates duplicates — T-07-15).
 *
 * ⚠️  DELIBERATELY NOT REGISTERED: the inventory-levels update topic. Subscribing
 *     to it would make every outbound pushInventory() re-fire a webhook back at
 *     us -> infinite feedback loop (RESEARCH Pitfall 3 / T-07-11). D-07's topic
 *     set is complete without it. See docs/shopify-sync.md before ever adding it.
 *
 * Usage: npm run shopify:setup --workspace=api   (run once, with prod env vars)
 */

require('dotenv').config();
const { shopifyRequest } = require('../services/shopifyClient');

// Fail loudly if the store / webhook base URL is not configured, rather than
// firing opaque GraphQL errors or registering webhooks at a bad host.
const REQUIRED_ENV = [
  'SHOPIFY_SHOP_DOMAIN',
  'SHOPIFY_API_VERSION',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'SHOPIFY_WEBHOOK_BASE_URL',
];

function assertConfigured() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Shopify setup aborted — missing required env var(s): ${missing.join(', ')}. ` +
        'Set them (see docs/shopify-sync.md) before running the one-time setup.'
    );
  }
}

// D-07 topic set (RESEARCH Pattern 6). Each maps a GraphQL WebhookSubscriptionTopic
// enum value to its inbound route path under /api/shopify/webhooks (see
// api/routes/shopifyWebhooks.js). This list is COMPLETE — the inventory-levels
// topic is intentionally absent (Pitfall 3 feedback loop).
const WEBHOOK_TOPICS = [
  { topic: 'ORDERS_PAID', path: 'orders-paid' },
  { topic: 'ORDERS_CANCELLED', path: 'orders-cancelled' },
  { topic: 'REFUNDS_CREATE', path: 'refunds-create' },
  { topic: 'PRODUCTS_CREATE', path: 'products-create' },
  { topic: 'PRODUCTS_UPDATE', path: 'products-update' },
  { topic: 'PRODUCTS_DELETE', path: 'products-delete' },
];

const LOCATIONS_QUERY = `
  query {
    locations(first: 5) {
      edges { node { id name } }
    }
  }
`;

const EXISTING_WEBHOOKS_QUERY = `
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

const WEBHOOK_CREATE_MUTATION = `
  mutation webhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        endpoint {
          __typename
          ... on WebhookHttpEndpoint { callbackUrl }
        }
      }
      userErrors { field message }
    }
  }
`;

function callbackUrlFor(path) {
  // Trim a trailing slash on the base so we don't emit a double slash.
  const base = process.env.SHOPIFY_WEBHOOK_BASE_URL.replace(/\/+$/, '');
  return `${base}/api/shopify/webhooks/${path}`;
}

/** Step 1: list locations so the operator can pin SHOPIFY_LOCATION_ID (D-16). */
async function listLocations() {
  console.log('📍 Querying Shopify locations (pin one as SHOPIFY_LOCATION_ID):');
  const data = await shopifyRequest(LOCATIONS_QUERY);
  const edges = (data.locations && data.locations.edges) || [];
  if (edges.length === 0) {
    console.log('   (no locations returned)');
    return;
  }
  for (const { node } of edges) {
    console.log(`   ${node.id}  —  ${node.name}`);
  }
}

/** Fetches the set of existing { topic, callbackUrl } pairs for idempotency. */
async function fetchExistingSubscriptions() {
  const data = await shopifyRequest(EXISTING_WEBHOOKS_QUERY);
  const edges = (data.webhookSubscriptions && data.webhookSubscriptions.edges) || [];
  const existing = new Set();
  for (const { node } of edges) {
    const url = node.endpoint && node.endpoint.callbackUrl;
    if (url) existing.add(`${node.topic}::${url}`);
  }
  return existing;
}

/** Step 2: idempotently register exactly the six D-07 topics. */
async function registerWebhooks() {
  console.log('\n🔔 Registering D-07 webhook topics (idempotent):');
  const existing = await fetchExistingSubscriptions();

  let created = 0;
  let skipped = 0;

  for (const { topic, path } of WEBHOOK_TOPICS) {
    const callbackUrl = callbackUrlFor(path);

    if (existing.has(`${topic}::${callbackUrl}`)) {
      skipped += 1;
      console.log(`   ⏭️  ${topic} -> ${callbackUrl} (already subscribed)`);
      continue;
    }

    const data = await shopifyRequest(WEBHOOK_CREATE_MUTATION, {
      topic,
      webhookSubscription: { callbackUrl, format: 'JSON' },
    });
    const result = data.webhookSubscriptionCreate;
    const userErrors = (result && result.userErrors) || [];
    if (userErrors.length > 0) {
      throw new Error(
        `webhookSubscriptionCreate failed for ${topic}: ${JSON.stringify(userErrors)}`
      );
    }

    created += 1;
    console.log(`   ✅ ${topic} -> ${callbackUrl}`);
  }

  console.log(`\n✅ Webhook setup complete: ${created} created, ${skipped} already present.`);
}

async function main() {
  assertConfigured();
  await listLocations();
  await registerWebhooks();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Shopify setup failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  });
