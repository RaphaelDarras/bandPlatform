/**
 * Direct Shopify Admin client (07.1 D-17). The client secret is baked into the
 * APK at build time — accepted risk per D-18; do not add mitigation here.
 *
 * Never log tokens, secrets or headers from this file.
 */

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class ShopifyError extends Error {
  kind: 'config' | 'network' | 'http' | 'graphql';
  status?: number;
  retryable: boolean;

  constructor(
    kind: 'config' | 'network' | 'http' | 'graphql',
    message: string,
    opts: { status?: number; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = 'ShopifyError';
    this.kind = kind;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

interface ShopifyConfig {
  shop: string;
  clientId: string;
  clientSecret: string;
  locationId: string;
  apiVersion: string;
}

// Literal process.env.EXPO_PUBLIC_* member access so Expo inlines at build time.
function getConfig(): ShopifyConfig {
  const shop = process.env.EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN;
  const clientId = process.env.EXPO_PUBLIC_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET;
  const locationId = process.env.EXPO_PUBLIC_SHOPIFY_LOCATION_ID;
  const apiVersion = process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || '2026-07';
  if (!shop || !clientId || !clientSecret || !locationId) {
    throw new ShopifyError('config', 'Shopify is not configured', { retryable: false });
  }
  return { shop, clientId, clientSecret, locationId, apiVersion };
}

let cached: { token: string; expiresAt: number } | null = null;

export function _resetTokenCache(): void {
  cached = null;
}

function enc(k: string, v: string): string {
  return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
}

export async function getAccessToken(force = false): Promise<string> {
  if (!force && cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.token;
  }
  const cfg = getConfig();
  let res: Response;
  try {
    res = await fetch(`https://${cfg.shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: [
        enc('grant_type', 'client_credentials'),
        enc('client_id', cfg.clientId),
        enc('client_secret', cfg.clientSecret),
      ].join('&'),
    });
  } catch {
    throw new ShopifyError('network', 'Shopify token exchange network error', { retryable: true });
  }
  if (!res.ok) {
    throw new ShopifyError('http', `Shopify token exchange failed: ${res.status}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const body = await res.json();
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 86399) * 1000,
  };
  return cached.token;
}

export async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const cfg = getConfig();
  const url = `https://${cfg.shop}/admin/api/${cfg.apiVersion}/graphql.json`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(attempt === 1);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new ShopifyError('network', 'Shopify GraphQL network error', { retryable: true });
    }

    if (res.status === 401 && attempt === 0) {
      cached = null;
      continue;
    }
    if (!res.ok) {
      throw new ShopifyError('http', `Shopify GraphQL request failed: ${res.status}`, {
        status: res.status,
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      const throttled = json.errors.some(
        (e: { extensions?: { code?: string } }) => e?.extensions?.code === 'THROTTLED',
      );
      // Carry Shopify's own reason (message + code + path) so a failure is
      // diagnosable from the log. GraphQL error bodies never echo the token.
      const detail = (json.errors as { message?: string; path?: unknown[]; extensions?: { code?: string } }[])
        .slice(0, 3)
        .map((e) =>
          [e?.extensions?.code, e?.message, e?.path ? `at ${e.path.join('.')}` : '']
            .filter(Boolean)
            .join(' '),
        )
        .join(' | ');
      throw new ShopifyError(
        'graphql',
        `${throttled ? 'Shopify GraphQL throttled' : 'Shopify GraphQL error'}${detail ? `: ${detail}` : ''}`,
        { retryable: throttled },
      );
    }
    return json.data as T;
  }
  throw new ShopifyError('http', 'Shopify GraphQL request failed: 401', {
    status: 401,
    retryable: false,
  });
}

// --- Catalogue ---------------------------------------------------------

export interface ShopifyCatalogueVariant {
  variantGid: string;
  sku: string;
  label: string;
  price: number;
  available: number;
}
export interface ShopifyCatalogueProduct {
  productGid: string;
  name: string;
  imageUrl: string | null;
  variants: ShopifyCatalogueVariant[];
}

// Note: if featuredMedia path errors in the live smoke (assumption A3), fall
// back to featuredImage { url }.
const CATALOGUE_QUERY = `query Catalogue($after: String, $loc: ID!) {
  products(first: 50, after: $after, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      featuredMedia { preview { image { url } } }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          price
          selectedOptions { name value }
          inventoryItem {
            id
            inventoryLevel(locationId: $loc) {
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
    }
  }
}`;

const VARIANT_LEVEL_QUERY = `query VariantLevel($variant: ID!, $loc: ID!) {
  productVariant(id: $variant) {
    inventoryItem {
      id
      inventoryLevel(locationId: $loc) {
        quantities(names: ["available"]) { name quantity }
      }
    }
  }
}`;

const ADJUST_MUTATION = `mutation Adj($input: InventoryAdjustQuantitiesInput!, $key: String!) {
  inventoryAdjustQuantities(input: $input) @idempotent(key: $key) {
    inventoryAdjustmentGroup { changes { name delta quantityAfterChange } }
    userErrors { field message code }
  }
}`;

interface QuantityLevel {
  quantities?: { name: string; quantity: number }[];
}
function availableOf(level: QuantityLevel | null | undefined): number {
  const q = level?.quantities?.find((x) => x.name === 'available');
  return q ? q.quantity : 0;
}

interface RawVariant {
  id: string;
  title?: string;
  sku?: string | null;
  price: string;
  selectedOptions?: { name: string; value: string }[];
  inventoryItem?: { id: string; inventoryLevel?: QuantityLevel | null } | null;
}
interface RawProduct {
  id: string;
  title: string;
  featuredMedia?: { preview?: { image?: { url?: string } | null } | null } | null;
  variants: { nodes: RawVariant[] };
}

function mapVariant(v: RawVariant): ShopifyCatalogueVariant {
  const opts = v.selectedOptions ?? [];
  const isDefault = opts.length === 1 && opts[0].name === 'Title' && opts[0].value === 'Default Title';
  return {
    variantGid: v.id,
    sku: v.sku ?? '',
    label: isDefault ? '' : opts.map((o) => o.value).join(' / '),
    price: parseFloat(v.price),
    available: availableOf(v.inventoryItem?.inventoryLevel),
  };
}

export async function fetchCatalogue(): Promise<ShopifyCatalogueProduct[]> {
  const { locationId } = getConfig();
  const out: ShopifyCatalogueProduct[] = [];
  let after: string | null = null;
  for (;;) {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawProduct[];
      };
    } = await gql(CATALOGUE_QUERY, { after, loc: locationId });
    for (const p of data.products.nodes) {
      out.push({
        productGid: p.id,
        name: p.title,
        imageUrl: p.featuredMedia?.preview?.image?.url ?? null,
        variants: p.variants.nodes.map(mapVariant),
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return out;
}

export async function readVariantLevel(
  variantGid: string,
): Promise<{ inventoryItemId: string; available: number } | null> {
  const { locationId } = getConfig();
  const data = await gql<{
    productVariant: { inventoryItem: { id: string; inventoryLevel?: QuantityLevel | null } } | null;
  }>(VARIANT_LEVEL_QUERY, { variant: variantGid, loc: locationId });
  if (!data.productVariant) return null;
  const item = data.productVariant.inventoryItem;
  return { inventoryItemId: item.id, available: availableOf(item.inventoryLevel) };
}

export interface AdjustInput {
  inventoryItemId: string;
  delta: number;
  changeFromQuantity: number | null;
  referenceDocumentUri: string;
  idempotencyKey: string;
}
export type AdjustResult =
  | { ok: true; appliedDelta: number }
  | { ok: false; code: string; message: string };

export async function adjustAvailable(input: AdjustInput): Promise<AdjustResult> {
  const { locationId } = getConfig();
  const data = await gql<{
    inventoryAdjustQuantities: {
      inventoryAdjustmentGroup?: { changes?: { name: string; delta: number }[] } | null;
      userErrors?: { field?: string[]; message: string; code?: string }[];
    };
  }>(ADJUST_MUTATION, {
    key: input.idempotencyKey,
    input: {
      name: 'available',
      reason: 'correction',
      referenceDocumentUri: input.referenceDocumentUri,
      changes: [
        {
          inventoryItemId: input.inventoryItemId,
          locationId,
          delta: input.delta,
          changeFromQuantity: input.changeFromQuantity,
        },
      ],
    },
  });
  const res = data.inventoryAdjustQuantities;
  const err = res.userErrors?.[0];
  if (err) {
    return { ok: false, code: err.code ?? 'UNKNOWN', message: err.message };
  }
  const change = res.inventoryAdjustmentGroup?.changes?.find((c) => c.name === 'available');
  return { ok: true, appliedDelta: change ? change.delta : input.delta };
}
