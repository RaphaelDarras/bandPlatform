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
- [ ] **Phase 4: Showcase Website** - Band presence with bio, discography, concerts, contact
- [ ] **Phase 5: Online Shop Core** - E-commerce catalog, cart, and guest checkout
- [ ] **Phase 6: Payment Processing** - Stripe and PayPal integration with order confirmations
- [ ] **Phase 7: Shop Enhancements** - Shipping, bundles, pre-orders, and customer features
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
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 5: Online Shop Core
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
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 6: Payment Processing
**Goal**: Customers can pay securely via Stripe or PayPal and receive automated order confirmations
**Depends on**: Phase 5
**Requirements**: SHOP-04, SHOP-05, SHOP-06, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Customer can pay with credit card via Stripe
  2. Customer can pay with PayPal account
  3. Customer receives order confirmation email immediately after successful payment
  4. System validates payment webhooks from Stripe and PayPal securely (prevents fraud)
  5. System marks orders as paid only after webhook confirmation (prevents payment failures)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 7: Shop Enhancements
**Goal**: Online shop provides complete e-commerce experience with shipping, bundles, and pre-orders
**Depends on**: Phase 6
**Requirements**: SHOP-09, SHOP-10, SHOP-12, SHOP-14, SHOP-15, SHOP-16
**Success Criteria** (what must be TRUE):
  1. Customer sees shipping cost calculated during checkout
  2. Customer can track order status (pending / shipped / delivered)
  3. Customer can search products by name or description
  4. Customer can access return and refund policy page
  5. Customer can purchase product bundles at combo pricing (album + shirt)
  6. Customer can pre-order products before stock arrives
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
| 4. Showcase Website | 0/TBD | Not started | - |
| 5. Online Shop Core | 0/TBD | Not started | - |
| 6. Payment Processing | 0/TBD | Not started | - |
| 7. Shop Enhancements | 0/TBD | Not started | - |
| 8. Immutable sale line snapshots | 0/TBD | Not started | - |
| 9. Concert-first selling UX | 0/TBD | Not started | - |
| 10. Design polish pass | 0/TBD | Not started | - |
| 11. Multi-tenant band-agnostic platform | 0/TBD | Not started | - |

---
*Created: 2026-02-13*
*Last updated: 2026-04-19 — Phase 11 added (multi-tenant band-agnostic platform; scope may warrant promotion to milestone)*
