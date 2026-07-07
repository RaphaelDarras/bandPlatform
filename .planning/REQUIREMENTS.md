# Requirements: Band Merch Platform

**Defined:** 2026-02-13
**Core Value:** Band members can record merchandise sales at concerts quickly and reliably, with stock automatically synchronized across online and physical sales channels, preventing overselling and lost revenue.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Concert POS (Mobile App)

- [x] **POS-01**: User can record sales offline without internet connectivity
- [x] **POS-02**: User can quickly select products with touch-friendly interface
- [x] **POS-03**: User can view transaction history for current concert
- [x] **POS-04**: User can see real-time inventory levels that sync when online
- [x] **POS-05**: User can authenticate with PIN or password
- [x] **POS-06**: App maintains battery efficiency for 4-6 hour events
- [x] **POS-07**: User sees warnings when product stock is low (< 5 units)
- [x] **POS-08**: User can view sales report with total amounts by concert
- [x] **POS-09**: User can add multiple items to a single transaction
- [x] **POS-10**: App automatically calculates transaction total based on selected items
- [x] **POS-11**: User can perform end-of-event inventory reconciliation
- [x] **POS-12**: App syncs transactions even in low-bandwidth conditions

### Online Shop (E-Commerce)

- [x] **SHOP-01**: Customer can browse product catalog with images
- [x] **SHOP-02**: Customer can add products to shopping cart
- [x] **SHOP-03**: Customer can checkout as guest (email only required)
- [x] **SHOP-04**: Customer can pay with Stripe credit card
- [x] **SHOP-05**: Customer can pay with PayPal
- [x] **SHOP-06**: Customer receives order confirmation email after purchase
- [x] **SHOP-07**: Site is mobile-responsive and works on all devices
- [x] **SHOP-08**: Customer can select product variants (size, color)
- [~] **SHOP-09**: ~~Customer sees shipping cost calculated during checkout~~ — DROPPED (Shopify pivot 2026-07-07): provided natively by Shopify checkout
- [~] **SHOP-10**: ~~Customer can track order status (pending/shipped/delivered)~~ — DROPPED (Shopify pivot 2026-07-07): provided natively by Shopify
- [x] **SHOP-11**: Site uses SSL/HTTPS encryption
- [~] **SHOP-12**: ~~Customer can search products by name or description~~ — DROPPED (Shopify pivot 2026-07-07): provided natively by Shopify storefront
- [x] **SHOP-13**: Customer sees stock availability (in stock/low stock/out of stock)
- [~] **SHOP-14**: ~~Customer can access return/refund policy page~~ — DROPPED (Shopify pivot 2026-07-07): handled in Shopify storefront
- [~] **SHOP-15**: ~~Customer can purchase product bundles (combo pricing)~~ — DROPPED (Shopify pivot 2026-07-07): use Shopify apps/discounts
- [~] **SHOP-16**: ~~Customer can pre-order products before stock arrives~~ — DROPPED (Shopify pivot 2026-07-07): use Shopify pre-order apps

> **Shopify pivot (2026-07-07):** The band keeps its own website but the shop entry redirects to a Shopify storefront rather than a self-built shop. SHOP-01–08/11/13 (Phase 5) and SHOP-04/05/06 (Phase 6) were delivered but are **superseded** — the self-built catalog/cart/checkout/payments go dark once /shop redirects to Shopify. SHOP-09/10/12/14/15/16 are dropped because Shopify provides them natively. New Phase 7 ("Shopify Integration") requirements — redirect + bidirectional Mongo↔Shopify product/inventory sync with conflict resolution — are defined during discuss/plan (see SHOP-17..SHOP-19 placeholders below).

- [ ] **SHOP-17** *(new, Phase 7)*: Website "Shop" entry redirects visitors to the Shopify storefront
- [ ] **SHOP-18** *(new, Phase 7)*: Products and inventory sync bidirectionally between Mongo DB and Shopify without overselling shared stock
- [ ] **SHOP-19** *(new, Phase 7)*: Conflict-resolution rules for divergent Mongo/Shopify updates are defined and documented; mobile POS continues writing to Mongo with no regression

### Inventory Management

- [x] **INV-01**: System maintains unified inventory across online and POS channels
- [x] **INV-02**: System prevents overselling when both channels are active
- [x] **INV-03**: System updates stock in real-time after each sale
- [x] **INV-04**: System maintains inventory transaction logs for auditing

### Showcase Website

- [x] **WEB-01**: Visitor can view band bio and history
- [x] **WEB-02**: Visitor can browse discography with streaming links
- [x] **WEB-03**: Visitor can view upcoming concert dates and venues
- [x] **WEB-04**: Visitor can access contact form or contact information

### Authentication & Security

- [x] **AUTH-01**: Admin can log in to mobile POS app securely
- [x] **AUTH-02**: System securely stores authentication credentials
- [x] **AUTH-03**: System validates payment webhooks from Stripe/PayPal

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Partner Features

- **PART-01**: System tracks partner product production fees
- **PART-02**: System calculates revenue share percentage per partner sale
- **PART-03**: Admin can generate partner settlement reports

### POS Enhancements

- **POS-14**: User can configure quick-add shortcuts for best-selling products
- **POS-15**: User can view real-time sales velocity (items sold per hour)
- **POS-16**: Customer can receive digital receipt via email at POS

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Customer accounts/loyalty program | Adds complexity, slows checkout; use guest checkout + external email list |
| In-app chat support | Real-time monitoring overhead; use contact form + email instead |
| Complex discount engine | Feature creep, UI complexity; simple percentage/fixed discounts sufficient |
| Multi-warehouse inventory | Over-engineering for single-band operation; single inventory pool |
| Card reader hardware integration | Unnecessary cost and complexity; manual card payment entry works fine |
| Real-time analytics dashboard | Development time vs value; basic reports sufficient for v1 |
| Built-in shipping label printing | Printer integration complexity; use shipping provider dashboard |
| Multi-currency support | Exchange rate and payment complexity; single currency (CAD) sufficient |
| Product reviews/ratings | Moderation overhead; leverage social media for testimonials |
| Automated marketing emails | Deliverability and legal compliance; use external tool (Mailchimp) |
| Time-based flash sales | Timezone complexity; use simple discount codes instead |
| Reservation/hold system | Race conditions and inventory blocking; first-come-first-served |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INV-01 | Phase 1 | Complete |
| INV-02 | Phase 1 | Complete |
| INV-03 | Phase 1 | Complete |
| INV-04 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| POS-01 | Phase 2 | Complete |
| POS-02 | Phase 2 | Complete |
| POS-03 | Phase 2 | Complete |
| POS-04 | Phase 2 | Complete |
| POS-05 | Phase 2 | Complete |
| POS-09 | Phase 2 | Complete |
| POS-10 | Phase 2 | Complete |
| AUTH-01 | Phase 2 | Complete |
| POS-06 | Phase 3 | Complete |
| POS-07 | Phase 3 | Complete |
| POS-08 | Phase 3 | Complete |
| POS-11 | Phase 3 | Complete |
| POS-12 | Phase 3 | Complete |
| WEB-01 | Phase 4 | Complete |
| WEB-02 | Phase 4 | Complete |
| WEB-03 | Phase 4 | Complete |
| WEB-04 | Phase 4 | Complete |
| SHOP-01 | Phase 5 | Complete |
| SHOP-02 | Phase 5 | Complete |
| SHOP-03 | Phase 5 | Complete |
| SHOP-07 | Phase 5 | Complete |
| SHOP-08 | Phase 5 | Complete |
| SHOP-11 | Phase 5 | Complete |
| SHOP-13 | Phase 5 | Complete |
| SHOP-04 | Phase 6 | Complete (superseded by Shopify) |
| SHOP-05 | Phase 6 | Complete (superseded by Shopify) |
| SHOP-06 | Phase 6 | Complete (superseded by Shopify) |
| AUTH-03 | Phase 6 | Complete (superseded by Shopify) |
| SHOP-09 | — | Dropped (Shopify pivot) |
| SHOP-10 | — | Dropped (Shopify pivot) |
| SHOP-12 | — | Dropped (Shopify pivot) |
| SHOP-14 | — | Dropped (Shopify pivot) |
| SHOP-15 | — | Dropped (Shopify pivot) |
| SHOP-16 | — | Dropped (Shopify pivot) |
| SHOP-17 | Phase 7 | Pending |
| SHOP-18 | Phase 7 | Pending |
| SHOP-19 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 35 active (32 delivered + 3 new for Phase 7); 6 dropped in the Shopify pivot (SHOP-09/10/12/14/15/16)
- Mapped to phases: 35 (100% of active)
- Unmapped: 0
- Note: SHOP-04/05/06 (payments) and the Phase 5 shop requirements were delivered but are superseded going forward by the Shopify storefront.

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after roadmap creation with traceability mappings*
*Last updated: 2026-07-07 — Shopify pivot: dropped SHOP-09/10/12/14/15/16 (Shopify-native); added SHOP-17/18/19 for Phase 7 Shopify Integration; annotated SHOP-04/05/06 + Phase 5 shop requirements as superseded.*
