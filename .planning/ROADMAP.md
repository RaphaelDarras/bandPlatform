# Roadmap: Band Merch Platform

## Overview

This roadmap delivers a complete dual-channel merchandise platform for concert sales and online e-commerce. The journey prioritizes mobile POS first (urgent April concert deadline), then adds online shop capabilities, with unified inventory management preventing overselling across channels. Seven phases deliver 38 v1 requirements from foundation to full-featured platform.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Inventory Core** - API infrastructure with atomic inventory operations (completed 2026-03-12)
- [x] **Phase 2: Mobile POS Core** - Offline-first concert sales tool with core transaction features (completed 2026-03-14)
- [x] **Phase 3: Mobile POS Optimization** - Battery efficiency, reconciliation, and sync reliability (completed 2026-03-18)
- [x] **Phase 4: Showcase Website** - Band presence with bio, discography, concerts, contact (completed 2026-07-03)
- [x] **Phase 5: Online Shop Core** - E-commerce catalog, cart, and guest checkout (completed 2026-07-05) — ⚠ SUPERSEDED by Shopify pivot (Phase 7): self-built storefront goes dark once /shop redirects to Shopify
- [x] **Phase 6: Payment Processing** - Stripe and PayPal integration with order confirmations (completed 2026-07-06) — ⚠ SUPERSEDED by Shopify pivot (Phase 7): Shopify owns payments; the 5-item human-UAT is now moot
- [ ] **Phase 7: Shopify Integration** - Website shop-entry redirects to a Shopify storefront; Mongo DB ↔ Shopify bidirectional product + inventory sync
- [ ] **Phase 8: Immutable sale line snapshots** - Snapshot product name + variant label on sale items so history survives product/variant deletion
- [ ] **Phase 9: Concert-first selling UX** - Make concert-linked sales the default fast path from dashboard; lone sale becomes a rare fallback
- [ ] **Phase 10: Design polish pass** - Lift mobile app visual quality from functional prototype to professional product (icon library, design tokens, typography scale, loading states)
- [ ] **Phase 11: Multi-tenant band-agnostic platform** - Convert single-tenant (Hurakan) product into a multi-tenant platform any band can sign up for, configure, and customize (scope likely milestone-sized — revisit during discuss)

## Phase Details

### Phase 1: Foundation & Inventory Core

**Goal**: Unified inventory system with atomic operations prevents overselling across all sales channels
**Depends on**: Nothing (first phase)
**Requirements**: INV-01, INV-02, INV-03, INV-04, AUTH-02
**Success Criteria** (what must be TRUE):

  1. System maintains single inventory count across POS and online channels
  2. Concurrent transactions cannot oversell last available item (race condition prevented)
  3. System logs every inventory change with timestamp and source channel
  4. System stores admin credentials securely (hashed, never plaintext)
  5. API endpoints respond to product queries and inventory updates

**Plans**: 6 plans in 2 waves

Plans:

- [ ] 01-01-PLAN.md — Database schemas with optimistic locking (Products, Orders, Concerts)
- [ ] 01-02-PLAN.md — Authentication system (bcrypt password hashing, JWT tokens)
- [ ] 01-03-PLAN.md — API endpoints with atomic inventory operations
- [ ] 01-04-PLAN.md — Gap closure: Inventory restock endpoint with audit trail
- [ ] 01-05-PLAN.md — Gap closure: Safe product update endpoint protecting inventory fields
- [ ] 01-06-PLAN.md — Gap closure: Read-only stock summary endpoint (total stock view)

### Phase 2: Mobile POS Core

**Goal**: Band members can track concert sales and manage inventory offline with automatic sync when connectivity returns
**Depends on**: Phase 1
**Requirements**: POS-01, POS-02, POS-03, POS-04, POS-05, POS-09, POS-10, AUTH-01
**Success Criteria** (what must be TRUE):

  1. User can record sales at concert venue without internet connection
  2. User can select products and add multiple items to transaction with touch-friendly UI
  3. App automatically calculates transaction total based on selected products
  4. User can view transaction history filtered by current concert
  5. User can see real-time inventory levels that update when app connects to network
  6. User can authenticate into app with PIN or password
  7. App syncs queued offline transactions automatically when connectivity restored

**Plans**: 9 plans in 3 waves

Plans:

- [ ] 02-01-PLAN.md — API extensions: Sale model migration, PIN auth endpoints, Concert CRUD
- [ ] 02-02-PLAN.md — API extensions: Batch sale submission with idempotency, void/unvoid endpoints
- [ ] 02-03-PLAN.md — Mobile project scaffold: Expo init, SQLite data layer, Zustand stores, i18n
- [ ] 02-04-PLAN.md — PIN authentication flow and tab navigation shell with dashboard
- [ ] 02-05-PLAN.md — Selling flow: product grid, variant picker, cart, review screen, sale recording
- [ ] 02-06-PLAN.md — Concert management screens, transaction history with void/unvoid
- [ ] 02-07-PLAN.md — Sync manager, stock overview, restock, dashboard wiring, product management
- [ ] 02-08-PLAN.md — Gap closure: Fix discount display, void stock reversal, product deactivation
- [ ] 02-09-PLAN.md — Gap closure: i18n settings screen, offline detection improvements

### Phase 3: Mobile POS Optimization

**Goal**: Mobile POS operates reliably during 4-6 hour concert events with low-bandwidth sync and inventory reconciliation
**Depends on**: Phase 2
**Requirements**: POS-06, POS-07, POS-08, POS-11, POS-12
**Success Criteria** (what must be TRUE):

  1. App battery usage allows 4-6 hour events without recharge
  2. User sees warnings when product stock drops below 5 units
  3. User can view sales reports with total amounts filtered by concert
  4. User can perform end-of-event inventory reconciliation
  5. App syncs transactions successfully even on poor cellular connections

**Plans**: 3 plans in 1 wave

Plans:

- [ ] 03-01-PLAN.md — Low-stock color warnings across all UI + POS-06/POS-11 documentation
- [ ] 03-02-PLAN.md — Per-concert sales report with product/variant and payment breakdowns
- [ ] 03-03-PLAN.md — Enhanced sync indicator with last-sync time, Sync Now button, cold-start protection

### Phase 4: Showcase Website

**Goal**: Visitors can learn about the band and access essential information before shopping
**Depends on**: Phase 1
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04
**Success Criteria** (what must be TRUE):

  1. Visitor can read band bio and history on website
  2. Visitor can browse discography with links to streaming platforms
  3. Visitor can view upcoming concert dates with venue information
  4. Visitor can submit contact form or access contact information

**Plans**: 5 plans in 3 waves

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Monorepo workspaces + web scaffold (Vite 7/React 19/Tailwind v4/vite-react-ssg) + test infra + app shell + data contracts
- [x] 04-02-PLAN.md — Bandsintown build-time client + Concerts page + Home hero/next-concert (WEB-03)
- [x] 04-03-PLAN.md — Discography: Spotify/YouTube embeds mapped from releases config (WEB-02)
- [x] 04-04-PLAN.md — About + Contact static pages + /stock migration (WEB-01, WEB-04, D-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-05-PLAN.md — Build gate + Vercel deploy + hurakanband.fr cutover + retire GitHub Pages/crowned

### Phase 5: Online Shop Core

**⚠ SUPERSEDED (Shopify pivot, Phase 7)**: Shipped and complete, but the self-built catalog/cart/guest-checkout is replaced by a redirect to the Shopify storefront. Code remains in the repo but goes dark once /shop redirects out.

**Goal**: Customers can browse products and purchase merchandise online with guest checkout
**Depends on**: Phase 4
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-07, SHOP-08, SHOP-11, SHOP-13
**Success Criteria** (what must be TRUE):

  1. Customer can browse product catalog with images on any device (mobile/desktop)
  2. Customer can add products to shopping cart
  3. Customer can checkout as guest using email only (no account required)
  4. Customer can select product variants (size, color) during purchase
  5. Site uses HTTPS encryption for all pages
  6. Customer sees stock availability (in stock / low stock / out of stock)

**Plans**: 11 plans in 4 waves

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Shared Product/Order types + browser product fetch client + VITE_API_URL + health ping
- [x] 05-02-PLAN.md — zustand legitimacy checkpoint + install (blocking human-verify)
- [x] 05-03-PLAN.md — Remove Meta Pixel/CAPI (D-27) + Stock.tsx D-15 threshold reconcile note
- [x] 05-04-PLAN.md — StockBadge (D-15 3-state) + QuantityStepper (D-18) leaf components

**Wave 2** *(blocked on Wave 1)*

- [x] 05-05-PLAN.md — Cart store (zustand persist + skipHydration) + Layout rehydrate/keep-alive
- [x] 05-06-PLAN.md — Catalog page + CatalogGrid (SHOP-01/07) + D-25 manual-seed doc

**Wave 3** *(blocked on Wave 2)*

- [x] 05-07-PLAN.md — Product detail: gallery, variant selector, stepper, add-to-cart (SHOP-08/13)
- [x] 05-08-PLAN.md — Cart page: revalidation, flagging, checkout gate, empty state (SHOP-02/13, D-14)
- [x] 05-09-PLAN.md — Guest checkout form (form-only, disabled submit) (SHOP-03, D-01/02/03)
- [x] 05-10-PLAN.md — Header cart icon/badge + Shop nav + Home merch teaser (D-20/D-21)

**Wave 4** *(blocked on Wave 3)*

- [x] 05-11-PLAN.md — Shop routes + Vercel /shop rewrite + prerender assertions (SHOP-01/11, D-06)

### Phase 6: Payment Processing

**⚠ SUPERSEDED (Shopify pivot, Phase 7)**: Shipped and complete, but self-built Stripe/PayPal checkout is replaced by Shopify's payments once /shop redirects to Shopify. Code remains in the repo but goes dark. The 5-item human-UAT in `06-VERIFICATION.md` / `06-HUMAN-UAT.md` is now moot — close it as "superseded" rather than running the live payment tests.

**Goal**: Customers can pay securely via Stripe or PayPal and receive automated order confirmations
**Depends on**: Phase 5
**Requirements**: SHOP-04, SHOP-05, SHOP-06, AUTH-03
**Success Criteria** (what must be TRUE):

  1. Customer can pay with credit card via Stripe
  2. Customer can pay with PayPal account
  3. Customer receives order confirmation email immediately after successful payment
  4. System validates payment webhooks from Stripe and PayPal securely (prevents fraud)
  5. System marks orders as paid only after webhook confirmation (prevents payment failures)

**Plans**: 8 plans in 4 waves

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Package legitimacy checkpoint + install (stripe/@paypal/paypal-server-sdk/resend) + env vars + PayPal CJS interop guard
- [x] 06-02-PLAN.md — Order model shippingAddress + toJSON, crypto orderNumber service, shared types (D-04/D-11)

**Wave 2** *(blocked on Wave 1)*

- [x] 06-03-PLAN.md — Stripe/PayPal client services + currency-unit helpers (SHOP-04/05, D-02)
- [x] 06-04-PLAN.md — Resend email service: customer confirmation (VAT mention) + band notification (SHOP-06, D-13/D-17)
- [x] 06-07-PLAN.md — orders.ts client + Checkout activation + provider selector + € relabel (D-01/D-03)

**Wave 3** *(blocked on Wave 2)*

- [x] 06-05-PLAN.md — POST /api/orders: pending order + server price recompute + provider session (D-05/D-06)
- [x] 06-08-PLAN.md — Success/Cancel/PaypalReturn pages + routes (D-15/D-16)

**Wave 4** *(blocked on Wave 3)*

- [x] 06-06-PLAN.md — Webhooks (raw-body mount, signature verify, atomic idempotent paid + stock $inc + emails) + go-live checklist (AUTH-03, D-07/D-08/D-09/D-10/D-19)

### Phase 7: Shopify Integration

**Goal**: The band keeps its own website, but the shop entry redirects to a Shopify storefront, and the existing Mongo DB is linked to Shopify via bidirectional product + inventory sync so the mobile POS (Mongo) and the Shopify storefront never oversell or drift.
**Depends on**: Phase 4 (Showcase Website — the "Shop" entry point) and Phase 1 (Foundation & Inventory Core — the Mongo product/inventory model that syncs to Shopify)
**Requirements**: SHOP-17, SHOP-18, SHOP-19 (new — redirect + bidirectional sync + conflict resolution; refine during discuss/plan). Supersedes the dropped self-built enhancement requirements SHOP-09/10/12/14/15/16, which Shopify provides natively.
**Success Criteria** (what must be TRUE):

  1. The website "Shop" entry redirects visitors to the Shopify storefront (no self-built catalog/checkout in the redirect path).
  2. A product created or updated in Mongo appears in Shopify, and a product created or updated in Shopify appears in Mongo.
  3. An inventory change in either system (a POS sale in Mongo, a storefront sale in Shopify) propagates to the other without overselling the shared stock.
  4. Conflict-resolution rules for simultaneous/divergent updates are defined and documented (which system wins per field, how races are reconciled).
  5. The mobile POS continues to write stock to Mongo with no regression to the offline-first sale/sync flow.

**Notes**:

- This phase replaces the former "Shop Enhancements" phase. Shipping, order tracking, product search, returns/refund policy, bundles, and pre-orders (old SHOP-09/10/12/14/15/16) are now delivered by Shopify rather than built in-house.
- Phases 5 (Online Shop Core) and 6 (Payment Processing) are superseded once the shop entry redirects to Shopify — their code remains in the repo but goes dark. Discuss-phase should decide whether to retire that code or leave it dormant.
- Sync direction is **bidirectional** (Shopify inventory sync + webhooks), per the pivot decision.

**Plans**: TBD

Plans:

- [ ] TBD during phase planning

### Phase 8: Immutable sale line snapshots

**Goal**: Sale history becomes immutable — deleting a product or variant never changes what a past concert breakdown or sale detail shows. Names and labels are snapshotted on the sale item at sale time and rendered from storage, not resolved from live product data.
**Depends on**: Phase 3 (mobile POS write path) and Phase 1 (backend Sale model)
**Requirements**: New (driven by observed bug — concert breakdown showed raw SKU after a variant was deleted)
**Success Criteria** (what must be TRUE):

  1. Every new sale line item persists `productName` and `variantLabel` alongside `productId` and `variantSku` — both locally (SQLite `items_json`) and server-side (MongoDB `SaleItemSchema`).
  2. The write path (`useSaleRecording.ts` → `recordSaleLocally` → outbox payload → backend `POST /sales`) carries the snapshot end-to-end from cart to DB.
  3. Concert breakdowns (`features/concerts/useConcerts.ts`) and sale detail (`app/history/[saleId].tsx`) render from the stored snapshot; live product lookup is removed from these read paths.
  4. A one-time mobile migration runs on first launch of the new build: scans `sales.items_json`, and for each item missing `productName`/`variantLabel`, best-effort resolves against the current products cache and writes back. Idempotent; guarded by a schema/migration version marker so it runs exactly once per device.
  5. A matching server-side migration backfills existing `Sale.items[]` documents from current `Product` docs. Also idempotent.
  6. Sale items whose variant was already deleted before migration — and therefore can't be resolved — render a clear fallback copy (`"Deleted variant"` or equivalent) rather than the raw SKU or an empty string.
  7. Deleting a product or variant after this phase ships has zero effect on the rendering of any past sale, recap, or concert breakdown.

**Plans**: TBD

Plans:

- [ ] TBD during phase planning

### Phase 9: Concert-first selling UX

**Goal**: Band members reach a concert-linked selling screen from the dashboard in one tap (or at most two, when disambiguation is required), and lone sales — the current default — become a rare, explicit fallback.
**Depends on**: Phase 2 (Mobile POS Core — selling flow, cart store concert context) and Phase 3 (concert report UI)
**Requirements**: New (driven by user report that lone sales almost never happen in practice; going through Concerts tab → list → detail → Start Selling to attach a sale to a concert is too many taps for the common case)
**Success Criteria** (what must be TRUE):

  1. With exactly one active concert, the dashboard primary CTA opens the selling screen with that concert pre-selected — no intermediate screens.
  2. With multiple active concerts, the dashboard surfaces them (as inline cards or a picker) so a band member can tap directly into selling for the chosen concert.
  3. With zero active concerts, the dashboard CTA prompts to create a concert first (or offers an explicit "sell without a concert" affordance) — the silent "lone sale" default is removed.
  4. The existing concert-detail "Start Selling" button (recently promoted above the Product Breakdown) continues to work as a secondary path — no regression for users who navigate that way.
  5. Lone sales remain possible but are an explicit choice (secondary card, long-press, settings toggle, or menu item — mechanism decided during discuss), never the implicit default.
  6. The cart store's concert context (`concertId`, concert currency) is set correctly before navigating to `/selling`, matching what the concert-detail path does today.
  7. No regression to history, stock, or sync: sales linked this way are indistinguishable on the server and in reports from sales linked via the concert-detail flow.

**Plans**: TBD

Plans:

- [ ] TBD during phase planning

### Phase 10: Design polish pass

**Goal**: The mobile app stops looking like a functional prototype and starts looking like a professional product — consistent iconography, a single source of truth for colors, a reusable typography scale, and at least one polish gesture on high-traffic screens. A band member demoing the app to a label or venue should not flinch at the visuals.
**Depends on**: Phase 2 (Mobile POS Core — screens exist to polish) and Phase 3 (Mobile POS Optimization — last round of functional changes). Ideally sequenced AFTER Phase 9 (Concert-first selling UX) so the dashboard's final layout is polished, not an interim one.
**Requirements**: New (driven by user observation that emoji icons, hardcoded hex colors, ad-hoc font sizes, and minimal interaction feedback make the app feel unfinished).
**Success Criteria** (what must be TRUE):

  1. Every emoji used as an icon (🎸 🎤 📋 📦 ⚠️ ⬜ ⚙️ ↻ etc. in dashboard cards, tab bar, sync indicator, empty states, badges) is replaced by a real icon — either an installed RN icon library or a curated SVG set — with a single import site.
  2. Colors are centralized: no raw hex literals (e.g., `#208AEF`, `#f8f9fa`, `#ef4444`, `#22c55e`, `#dcfce7`) remain in screen code; all colors route through `useTheme()` or an equivalent tokens module. Dark mode contrast is audited as part of this.
  3. A typography scale exists (e.g., `display`, `heading`, `title`, `body`, `caption`) with named text styles; screens use those utilities instead of ad-hoc `fontSize: 15, fontWeight: '600'` pairs.
  4. At least one polish gesture ships on every high-traffic screen: skeleton loaders on the concert list, products list, history list, and stock list (in place of the current centered ActivityIndicator cold-load state), OR a transition animation on tab switches and navigation pushes — whichever approach is chosen in discuss.
  5. Badges and pills (Active/Closed concert badge, dashboard alert card, deficit screen warnings) use a single color/shape/size system instead of per-screen ad-hoc styling.
  6. Press feedback on interactive elements goes beyond `opacity: 0.85` where appropriate (scale transform, color ramp, or haptic feedback — discuss-phase decides the scope).
  7. A before/after review is conducted on key screens (dashboard, selling flow, concert detail, history, stock) — captured either as side-by-side screenshots in the phase summary or a demo video.
  8. No functional regressions: every existing flow (sell, close concert, void sale, restock, sync) works identically after the polish pass; this phase is style-only except where a design token replacement requires small structural tweaks.

**Open design questions for discuss-phase**:

- (1) Adopt a React Native icon library (lucide-react-native? Ionicons from expo/vector-icons? react-native-svg with a curated set?) or hand-roll a small SVG set specific to the app?
- (2) Formalize design tokens in a standalone `tokens.ts` file vs. extend `useTheme()` with richer structured values?
- (3) Define a type scale as React Native `StyleSheet` utilities or as a `<Text variant="...">` component?
- (4) Ship polish across all screens in one phase, or cut scope to dashboard + selling flow first and defer history/stock/settings to a Phase 10.1?
- (5) Dark mode audit: keep the current two-theme approach, or collapse to a single theme for now if dark mode isn't in active use?

**Plans**: TBD

Plans:

- [ ] TBD during phase planning

### Phase 11: Multi-tenant band-agnostic platform

**⚠ Scope warning**: This is almost certainly milestone-sized, not phase-sized. It touches database schema (tenant_id on every table), API authentication (tenant context on every request), mobile app (tenant-aware login + config), online shop (Phases 4-7 must be rebuilt around tenant context before they ship), admin provisioning, domain/subdomain routing, and — implied by "available to any interested bands" — some form of billing. Discuss-phase should either (a) aggressively cut scope to a single foundational plan (e.g., schema migration + tenant middleware only), or (b) re-frame as a new milestone v2.0 ("Multi-tenant platform") with this entry replaced by a placeholder and the real work planned as a fresh roadmap. Leaving this here as an entry so the idea is tracked, not lost.

**Goal**: The codebase (MongoDB + API + mobile app + upcoming e-shop) stops being Hurakan-specific and becomes a platform that any band can sign up for, provision, and customize. A new band onboards by providing their information (name, branding, admin PIN, currency default, Stripe/PayPal accounts when shop ships) and ends up with an isolated workspace: their own products, concerts, sales, admins, and web storefront. Nothing about one band's data, branding, or configuration is visible to another.
**Depends on**: Phase 1 (existing schema — migration source), Phase 2 (mobile auth flow — needs tenant awareness grafted on), Phase 4-7 (NOT YET BUILT — critical: discuss-phase should decide whether to wait until after Phase 7 ships and retrofit, or block Phase 4 planning and build multi-tenancy into the shop from day one; the latter is almost certainly cheaper despite taking longer to first value)
**Requirements**: New (driven by user intent to make the platform available to other bands, not just Hurakan)
**Success Criteria** (what must be TRUE):

  1. **Data isolation**: Every document in every collection (Product, Concert, Sale, Admin, Order, InventoryAdjustment, etc.) carries a `tenantId` field. No API endpoint returns cross-tenant data, and no query can omit the tenant filter — enforced by a layer, not by caller convention.
  2. **Authentication**: Login identifies the tenant. Admin PINs are unique per tenant, not globally. The mobile app opens in the context of one specific tenant and cannot be flipped mid-session.
  3. **Provisioning flow**: A new band can be onboarded end-to-end (create tenant, first admin account, default config) via a defined process — whether self-service signup or operator-driven, decided during discuss.
  4. **Mobile branding**: App title, accent color, logo, and default currency are per-tenant. The hardcoded "Hurakan Merch" title and `#208AEF` accent become tenant-provided values loaded at login.
  5. **Web UI customization**: The online shop (when it ships) renders with the tenant's band name, logo, color palette, and product catalog. At minimum: brand name, primary/accent colors, logo, hero copy. Out of scope unless discuss agrees: custom CSS, custom fonts, page-builder UI.
  6. **Domain/subdomain routing**: Each tenant is reachable at a predictable URL (`<slug>.platform.com` or `platform.com/<slug>` — decided in discuss). Mobile app routes to its tenant's API without the user typing a URL.
  7. **Migration of Hurakan data**: Existing Hurakan data continues to work — the band becomes tenant #1 on the new platform, not a casualty of the refactor.
  8. **No regression**: Every existing flow (sell, sync, void, restock, concert management) works identically for Hurakan post-migration, and the new "platform mode" is invisible to a single-tenant user.
  9. **Security**: A penetration-test-equivalent sanity pass confirms cross-tenant data leakage is blocked at the API layer — request for tenant A's product with tenant B's auth returns 404/403, not the data.
 10. **Onboarding docs**: A band joining the platform has documented steps for initial setup (even if those steps are "email us your band name and we'll provision you" in v1). Billing (if included) is out of scope here unless discuss adds it.

**Open strategic questions for discuss-phase**:

- (1) **Phasing strategy**: retrofit after Phase 7 ships, OR block Phases 4-7 and build them multi-tenant from day one? The first is faster to Hurakan value; the second is cheaper long-term and avoids a painful retrofit.
- (2) **Tenancy model**: shared database with `tenantId` field (simplest, cheapest, weaker isolation) vs. database-per-tenant (strongest isolation, operationally heavier) vs. schema-per-tenant (middle ground)?
- (3) **Provisioning**: self-service signup with email verification, OR operator-driven (user creates tenants manually for known bands)? Impacts billing, abuse prevention, and onboarding complexity.
- (4) **Billing**: in scope for this phase/milestone or deferred entirely? "Available to any interested bands" implies monetization but doesn't commit to it.
- (5) **Hurakan migration**: does Hurakan's data become tenant_id=1 in the new schema, or does Hurakan run on legacy single-tenant infra alongside the new multi-tenant system?
- (6) **Customization depth**: minimum viable (name + color + logo) vs. medium (name + color + logo + custom hero copy + font pairing) vs. heavy (page builder, custom CSS)?
- (7) **Mobile app distribution**: one white-label app in the stores that accepts tenant credentials at login, OR per-tenant branded apps (requires separate app store submissions — much heavier)?

**Plans**: TBD

Plans:

- [ ] TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Inventory Core | 6/6 | Complete   | 2026-03-13 |
| 2. Mobile POS Core | 9/9 | Complete   | 2026-03-19 |
| 3. Mobile POS Optimization | 3/3 | Complete   | 2026-03-18 |
| 4. Showcase Website | 5/5 | Complete   | 2026-07-03 |
| 5. Online Shop Core | 11/11 | Complete (superseded by Shopify pivot) | 2026-07-05 |
| 6. Payment Processing | 8/8 | Complete (superseded by Shopify pivot) | 2026-07-06 |
| 7. Shopify Integration | 0/TBD | Not started | - |
| 8. Immutable sale line snapshots | 0/TBD | Not started | - |
| 9. Concert-first selling UX | 0/TBD | Not started | - |
| 10. Design polish pass | 0/TBD | Not started | - |
| 11. Multi-tenant band-agnostic platform | 0/TBD | Not started | - |

---
*Created: 2026-02-13*
*Last updated: 2026-04-19 — Phase 11 added (multi-tenant band-agnostic platform; scope may warrant promotion to milestone)*
*Last updated: 2026-07-07 — Shopify pivot: removed Phase 06.1 (Admin panel) and the old Phase 7 (Shop Enhancements); repurposed Phase 7 as "Shopify Integration" (redirect + bidirectional Mongo↔Shopify sync); annotated Phases 5 & 6 as superseded.*
