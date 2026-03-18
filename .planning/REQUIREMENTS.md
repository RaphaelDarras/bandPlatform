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
- [ ] **POS-08**: User can view sales report with total amounts by concert
- [x] **POS-09**: User can add multiple items to a single transaction
- [x] **POS-10**: App automatically calculates transaction total based on selected items
- [x] **POS-11**: User can perform end-of-event inventory reconciliation
- [ ] **POS-12**: App syncs transactions even in low-bandwidth conditions

### Online Shop (E-Commerce)

- [ ] **SHOP-01**: Customer can browse product catalog with images
- [ ] **SHOP-02**: Customer can add products to shopping cart
- [ ] **SHOP-03**: Customer can checkout as guest (email only required)
- [ ] **SHOP-04**: Customer can pay with Stripe credit card
- [ ] **SHOP-05**: Customer can pay with PayPal
- [ ] **SHOP-06**: Customer receives order confirmation email after purchase
- [ ] **SHOP-07**: Site is mobile-responsive and works on all devices
- [ ] **SHOP-08**: Customer can select product variants (size, color)
- [ ] **SHOP-09**: Customer sees shipping cost calculated during checkout
- [ ] **SHOP-10**: Customer can track order status (pending/shipped/delivered)
- [ ] **SHOP-11**: Site uses SSL/HTTPS encryption
- [ ] **SHOP-12**: Customer can search products by name or description
- [ ] **SHOP-13**: Customer sees stock availability (in stock/low stock/out of stock)
- [ ] **SHOP-14**: Customer can access return/refund policy page
- [ ] **SHOP-15**: Customer can purchase product bundles (combo pricing)
- [ ] **SHOP-16**: Customer can pre-order products before stock arrives

### Inventory Management

- [x] **INV-01**: System maintains unified inventory across online and POS channels
- [x] **INV-02**: System prevents overselling when both channels are active
- [x] **INV-03**: System updates stock in real-time after each sale
- [x] **INV-04**: System maintains inventory transaction logs for auditing

### Showcase Website

- [ ] **WEB-01**: Visitor can view band bio and history
- [ ] **WEB-02**: Visitor can browse discography with streaming links
- [ ] **WEB-03**: Visitor can view upcoming concert dates and venues
- [ ] **WEB-04**: Visitor can access contact form or contact information

### Authentication & Security

- [x] **AUTH-01**: Admin can log in to mobile POS app securely
- [x] **AUTH-02**: System securely stores authentication credentials
- [ ] **AUTH-03**: System validates payment webhooks from Stripe/PayPal

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
| POS-08 | Phase 3 | Pending |
| POS-11 | Phase 3 | Complete |
| POS-12 | Phase 3 | Pending |
| WEB-01 | Phase 4 | Pending |
| WEB-02 | Phase 4 | Pending |
| WEB-03 | Phase 4 | Pending |
| WEB-04 | Phase 4 | Pending |
| SHOP-01 | Phase 5 | Pending |
| SHOP-02 | Phase 5 | Pending |
| SHOP-03 | Phase 5 | Pending |
| SHOP-07 | Phase 5 | Pending |
| SHOP-08 | Phase 5 | Pending |
| SHOP-11 | Phase 5 | Pending |
| SHOP-13 | Phase 5 | Pending |
| SHOP-04 | Phase 6 | Pending |
| SHOP-05 | Phase 6 | Pending |
| SHOP-06 | Phase 6 | Pending |
| AUTH-03 | Phase 6 | Pending |
| SHOP-09 | Phase 7 | Pending |
| SHOP-10 | Phase 7 | Pending |
| SHOP-12 | Phase 7 | Pending |
| SHOP-14 | Phase 7 | Pending |
| SHOP-15 | Phase 7 | Pending |
| SHOP-16 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after roadmap creation with traceability mappings*
