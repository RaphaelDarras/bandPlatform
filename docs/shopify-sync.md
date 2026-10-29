# Shopify: catalogue + stock source of truth (since 07.1)

Shopify is the only store for products, variants, prices and stock.

- The mobile POS reads the catalogue and writes stock deltas directly to the
  Shopify Admin API (clamped at 0, idempotent, queued through the phone outbox).
- The Render API + Mongo hold Concerts, Sales (Shopify GID + snapshot lines),
  Admin/auth and Votes.
- Mongo Product / Order / InventoryAdjustment collections are read-only archives.
- Product authoring happens in the Shopify admin.
- POS sales do not create Shopify orders.

## Mobile build env vars

- `EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN`
- `EXPO_PUBLIC_SHOPIFY_CLIENT_ID`
- `EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET` (set as an EAS env var)
- `EXPO_PUBLIC_SHOPIFY_LOCATION_ID`
- `EXPO_PUBLIC_SHOPIFY_API_VERSION`

The credential-in-APK risk is accepted (single user, single phone).

## Removed in 07.1

The Phase 7 inbound sync machinery (inbound sync endpoints and the scheduled
nightly job) was removed. `api/scripts/shopifyTeardownWebhooks.js` is a one-off
tool (dry run by default, `--apply` to delete) used at cutover to unregister the
old subscriptions.
