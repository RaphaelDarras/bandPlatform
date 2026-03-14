# Roadmap: Band Merch Platform

## Overview

This roadmap delivers a complete dual-channel merchandise platform for concert sales and online e-commerce. The journey prioritizes mobile POS first (urgent April concert deadline), then adds online shop capabilities, with unified inventory management preventing overselling across channels. Seven phases deliver 38 v1 requirements from foundation to full-featured platform.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Inventory Core** - API infrastructure with atomic inventory operations (completed 2026-03-12)
- [ ] **Phase 2: Mobile POS Core** - Offline-first concert sales tool with core transaction features
- [ ] **Phase 3: Mobile POS Optimization** - Battery efficiency, reconciliation, and sync reliability
- [ ] **Phase 4: Showcase Website** - Band presence with bio, discography, concerts, contact
- [ ] **Phase 5: Online Shop Core** - E-commerce catalog, cart, and guest checkout
- [ ] **Phase 6: Payment Processing** - Stripe and PayPal integration with order confirmations
- [ ] **Phase 7: Shop Enhancements** - Shipping, bundles, pre-orders, and customer features

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
**Plans**: 7 plans in 3 waves

Plans:
- [ ] 02-01-PLAN.md — API extensions: Sale model migration, PIN auth endpoints, Concert CRUD
- [ ] 02-02-PLAN.md — API extensions: Batch sale submission with idempotency, void/unvoid endpoints
- [ ] 02-03-PLAN.md — Mobile project scaffold: Expo init, SQLite data layer, Zustand stores, i18n
- [ ] 02-04-PLAN.md — PIN authentication flow and tab navigation shell with dashboard
- [ ] 02-05-PLAN.md — Selling flow: product grid, variant picker, cart, review screen, sale recording
- [ ] 02-06-PLAN.md — Concert management screens, transaction history with void/unvoid
- [ ] 02-07-PLAN.md — Sync manager, stock overview, restock, dashboard wiring, product management

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
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Inventory Core | 6/6 | Complete   | 2026-03-13 |
| 2. Mobile POS Core | 6/7 | In Progress|  |
| 3. Mobile POS Optimization | 0/TBD | Not started | - |
| 4. Showcase Website | 0/TBD | Not started | - |
| 5. Online Shop Core | 0/TBD | Not started | - |
| 6. Payment Processing | 0/TBD | Not started | - |
| 7. Shop Enhancements | 0/TBD | Not started | - |

---
*Created: 2026-02-13*
*Last updated: 2026-03-14 after Phase 2 planning (7 plans in 3 waves)*
