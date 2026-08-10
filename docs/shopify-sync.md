# Shopify ⇄ Mongo Sync — Conflict Resolution & Operator Runbook

Phase 7 (SHOP-18/SHOP-19). This document is the durable record of **which system
wins for which field**, why, and the one deliberate synchronization *gap*. Read
it before changing any sync code — several of the rules below look like bugs but
are intentional design decisions (they were litigated once; do not re-litigate
or "helpfully" close them by accident).

The bidirectional design has **two independent authorities**: Mongo owns
*inventory*, Shopify owns *content*. They never overlap, so there is no single
"master" — the winner depends entirely on the field.

---

## 1. Inventory authority — Mongo is master, Shopify mirrors (D-01/D-06)

Mongo is the audited stock ledger: each variant carries a `version` optimistic
lock plus the Order / Sale / InventoryAdjustment audit trail, and it is where
offline POS sales land. Shopify only **mirrors** the count.

- An online Shopify sale flows in via the `orders/paid` webhook → stock is
  deducted **in Mongo** (through the same optimistic-lock path the POS uses,
  D-17) → the resulting **absolute** count is pushed back to Shopify.
- Pushes always send the **absolute authoritative count, never a delta**
  (D-06). This deliberately overwrites Shopify's own checkout auto-decrement so
  a single online sale is not counted twice (once locally by Shopify, once by
  our push).
- **Any inventory conflict resolves to Mongo's count.** Full stop.

## 2. Content authority — Shopify is master (D-02/D-12/D-13)

Product *content* — title, description, images, price — is authored in Shopify
and flows **down** to Mongo for POS display. Mongo-side edits still propagate
up, but on a true content conflict **Shopify wins**.

- **Price split (D-12):** Shopify stores one absolute variant price; Mongo
  splits it as `basePrice + priceAdjustment`.
  - *Outbound* (Mongo → Shopify): push `basePrice + priceAdjustment`.
  - *Inbound* (Shopify → Mongo): keep `basePrice` **frozen** and set
    `priceAdjustment = shopifyPrice − basePrice`. The frozen base absorbs the
    delta into the adjustment — do not recompute `basePrice` on update.
- **Images (D-13):** on pull, Mongo's `images[]` is **overwritten** with the
  Shopify CDN URLs, order preserved. The seed sends the original Mongo image
  URLs to Shopify once (Shopify re-hosts them); thereafter images are edited in
  Shopify and the CDN URLs are authoritative.

## 3. Oversell stance — prompt sync, accept the rare offline-POS race (D-03)

There is **no hard no-oversell guarantee** while the POS stays offline-first —
it cannot reserve online stock in real time at the point of sale. The only
residual race is an *offline POS sale not yet synced*. At band volume this
collision is rare and is handled **manually** (refund/restock). "Strict
no-oversell" is explicitly out of scope (it would require a POS redesign).

## 4. Lifecycle — soft-delete both directions (D-14/D-15)

No sync operation ever destroys data (Orders/Sales still reference products, and
the Phase 8 snapshot goal needs the rows preserved).

- **Product** deleted/archived in Shopify → Mongo `active:false`. Deactivated in
  Mongo → Shopify status `DRAFT`/`ARCHIVED`. Mapping: Mongo `active:true` ↔
  Shopify `ACTIVE`; `active:false` ↔ `DRAFT`/`ARCHIVED`.
- **Variant** removed in Shopify → Mongo variant `active:false` + `stock:0`
  (kept for history, hidden from POS and sync-out). Mongo variant deactivation →
  the variant is excluded from the authoritative `productSet` payload.

## 5. ⚠️ The DELIBERATE GAP — manual Shopify stock edits (Pitfall 3 / T-07-11)

**A stock number typed directly into the Shopify admin UI is NOT synced
instantly.** This is intentional, not a bug.

We deliberately do **not** subscribe to the `INVENTORY_LEVELS_UPDATE` webhook.
If we did, every outbound `pushInventory()` (§1) would itself fire an
inventory-levels webhook straight back at us → an **infinite feedback loop**.
Because Mongo is the inventory master (§1), a manual Shopify-side stock edit is
an out-of-band change to a mirror, and it is caught only by the **reconcile
backstop** (the periodic job that re-pushes Mongo's authoritative counts).

> **Future contributor warning:** do **not** add an `INVENTORY_LEVELS_UPDATE`
> subscription to `api/scripts/shopifySetup.js` or `api/routes/shopifyWebhooks.js`
> to "fix" this gap. The gap is the design. Adjust stock in Mongo (the master),
> not in the Shopify admin, and let reconcile clean up any manual drift.

## 6. Currency / VAT — manual Shopify config, no tax math in sync (D-11)

VAT/currency is configured **manually in the Shopify admin**, out of this repo.
The band operates under the French *franchise en base de TVA* (VAT-exempt):

- Store currency = **EUR**; tax collection **disabled**.
- Add the "TVA non applicable, art. 293 B du CGI" mention in Shopify manually.
- Mongo `basePrice + priceAdjustment` and the Shopify variant `price` are the
  **same all-inclusive EUR number** — the sync performs **no tax math**.

---

## Per-field authority table

| Field / concern                | Winner   | Rule / notes |
| ------------------------------ | -------- | ------------ |
| Inventory / stock count        | **Mongo**   | D-01/D-06 — absolute count pushed to Shopify; conflicts resolve to Mongo |
| Product title                  | **Shopify** | D-02 — flows down to Mongo `name` |
| Description                    | **Shopify** | D-02 — flows down to Mongo `description` |
| Images                         | **Shopify** | D-13 — Mongo `images[]` overwritten with Shopify CDN URLs, order preserved |
| Price                          | **Shopify** | D-12 — `basePrice` frozen, `priceAdjustment = shopifyPrice − basePrice` |
| Product active/archived state  | Both (soft) | D-14 — `active:true ↔ ACTIVE`, `active:false ↔ DRAFT/ARCHIVED` |
| Variant existence              | Both (soft) | D-15 — removed → `active:false` + `stock:0`, never hard-deleted |
| Manual Shopify-admin stock edit | **Reconcile only** | §5 — no `INVENTORY_LEVELS_UPDATE`; caught by the reconcile backstop |
| Currency / VAT                 | **Manual** | D-11 — Shopify admin config, no tax math in sync |

---

## Operator runbook — one-time go-live sequence (D-09/D-16)

All commands run from the repo root with **production** environment variables
set. Never commit real secrets — the scripts read everything from `process.env`
(see `api/.env.example` for the placeholder list).

### Required environment variables

| Variable                    | Purpose |
| --------------------------- | ------- |
| `MONGODB_URI`               | Mongo connection (seed only) |
| `SHOPIFY_SHOP_DOMAIN`       | `*.myshopify.com` store domain |
| `SHOPIFY_API_VERSION`       | Admin API version string, e.g. `2026-07` |
| `SHOPIFY_CLIENT_ID`         | Custom-app API client id (D-16) |
| `SHOPIFY_CLIENT_SECRET`     | Custom-app API client secret (also inbound webhook HMAC key) |
| `SHOPIFY_LOCATION_ID`       | Pinned inventory location gid (D-16); obtain via `shopify:setup` |
| `SHOPIFY_WEBHOOK_BASE_URL`  | Public base URL of this API (Render host) for webhook callbacks |

Both scripts **fail loudly** if any required variable is missing, rather than
performing a partial write or throwing an opaque error.

### Custom-app setup (D-16)

1. In the Shopify **Developer Dashboard**, create a **custom (single-store)**
   app. Scopes: read/write products, read/write inventory, read orders, read
   locations.
2. Copy the Client ID / Client Secret into the env vars above. The
   client-credentials flow exchanges these for a short-lived (~24h) Admin token
   — there is **no** static Admin token env var.

### Go-live order

1. **Manual pre-step (D-09):** in the Shopify admin (**Products**), delete the
   throwaway Shopify **test product** by hand. Do this *before* seeding — the
   seed does not build one-off logic to detect or remove it.
2. **Pin the location + register webhooks:**
   ```
   npm run shopify:setup --workspace=api
   ```
   Step 1 prints the location gids — copy the correct one into
   `SHOPIFY_LOCATION_ID` and re-run if it was not yet set. Step 2 idempotently
   registers exactly the six D-07 topics (`orders/paid`, `orders/cancelled`,
   `refunds/create`, `products/create|update|delete`). Safe to re-run — existing
   subscriptions to the same URL are skipped. It never registers
   `INVENTORY_LEVELS_UPDATE` (§5).
3. **Seed the catalog:**
   ```
   npm run seed:shopify --workspace=api
   ```
   Exports every active Mongo product to Shopify, captures the returned Shopify
   ids back onto the Mongo docs (`shopifyProductId`, variant
   `shopifyVariantId`/`shopifyInventoryItemId`), and sets Shopify stock from
   Mongo. Idempotent — already-linked products are skipped, so a re-run after a
   partial failure only exports the remaining unlinked products.

### Reconcile backstop

The periodic reconcile job re-pushes Mongo's authoritative inventory counts to
Shopify. It is the **only** mechanism that corrects a manual Shopify-admin stock
edit (§5) and the safety net for any transient push failure (a variant flagged
`syncPending:true`). Keep it running; do not replace it with an
`INVENTORY_LEVELS_UPDATE` subscription.
