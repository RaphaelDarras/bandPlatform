# Phase 1: Foundation & Inventory Core - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Building the API infrastructure and MongoDB database with inventory management system that prevents overselling when both online shop and concert POS are selling simultaneously. This foundation enables all future phases.

</domain>

<decisions>
## Implementation Decisions

### Database Schema Design

**Products Structure:**
- Single Products collection with embedded variants
- Each variant includes: sku, size, color, stock, version field
- Version field per variant (not per product) for independent concurrent updates

**Inventory Tracking:**
- Inventory changes tracked within Orders/Sales documents only (no separate Inventory collection)
- Each order/sale embeds: product_id, variant_sku, quantity, stock_before, stock_after

**Concert Structure:**
- Simple concert documents: name, date, location, active status
- Sales link to concert via concert_id reference
- No pre-allocation of stock per concert

**Stock Updates:**
- Update product.variants array directly using MongoDB array operators
- Find variant by SKU, decrement stock atomically

### Concurrency & Race Conditions

**Concurrency Strategy:**
- Optimistic locking with version field per variant
- Conflict handling: fail immediately without retry (return "out of stock" error)
- Low stock threshold: below 5 units (triggers warnings and extra visibility)

**Online Shop Stock Management:**
- Reserve stock with timeout during checkout (10 minute hold)
- Check stock before payment starts, reserve during payment flow
- Auto-restore stock on payment failure (webhook cancellation/failure)
- Deduct after successful payment webhook confirmation

**Mobile POS Stock Management:**
- Offline POS uses last-known stock (accepts risk of conflicts)
- Online shop always checks real-time stock (priority channel)
- Concurrent POS sales: first write wins (whoever syncs first gets the sale)
- Sync rejection: if offline sale exceeds available stock when syncing, server rejects transaction

**Version Field Implementation:**
- Per-variant version field for maximum concurrency
- Each size/color can be updated independently without locking other variants
- Update pattern: match on product_id + variant_sku + current version, increment version on update

### Claude's Discretion

- Exact MongoDB query patterns and indexes
- Error message wording for stock conflicts
- Logging strategy for inventory changes
- API endpoint structure and naming
- Authentication token expiration timing

</decisions>

<specifics>
## Specific Ideas

- MongoDB chosen over PostgreSQL (user preference, despite research recommendation)
- System must support dual-channel sales from day one (online + POS)
- April deadline for concert sales tool creates urgency for Phase 2

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-inventory-core*
*Context gathered: 2026-02-13*
