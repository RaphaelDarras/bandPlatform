# Phase 2: Mobile POS Core - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Offline-first React Native/Expo mobile app for recording merchandise sales at concerts. Band members can authenticate, select a concert, record multi-item transactions with variant selection, view transaction history, manage stock, and sync queued sales automatically when connectivity returns. The app works fully offline during events.

Requirements: POS-01, POS-02, POS-03, POS-04, POS-05, POS-09, POS-10, AUTH-01

</domain>

<decisions>
## Implementation Decisions

### Sales Flow & Cart UX

- **Product selection**: Grid of product tiles showing product name, image thumbnail, price, and per-variant stock counts directly on the tile
- **Variant selection**: Bottom sheet picker for multi-variant products showing each variant with its individual stock count (e.g. "S — 3 left", "M — 12 left", "XL — 0"). Single-variant products add directly to cart on tap (no picker)
- **Cart behavior**: Sticky bottom bar in portrait mode showing item count + total. Tap to expand full cart with quantity controls. In selling mode, cart bar replaces the bottom tab bar navigation; back arrow in top-left exits selling mode
- **Sale completion**: Full review screen showing all items, quantities, total, payment method selection, currency, and discount before final confirm
- **Payment methods**: Cash, Card (external reader), E-transfer, PayPal — app tags which method was used, no in-app payment processing
- **Discount**: Manual discount field per sale on the review screen (flat amount or percentage on the whole transaction)
- **Post-sale**: Brief success toast, cart resets, immediately back to product grid
- **Void sales**: Void from transaction history detail screen. Voided sales remain visible with "VOIDED" badge. Voided sales can be unvoided (reversed)
- **Per-concert price overrides**: Default prices come from database. Before or during a concert, prices can be overridden for specific products — applies only to that concert session. Price overrides reset each new concert (not carried forward)
- **Currency**: Per-sale currency selection. EUR as default. Tapping the currency field shows a configurable list of currencies (EUR, GBP, USD, etc.)

### Concert Session Model

- **Concert selection**: List of pre-created concerts (from API) plus a "+ New Concert" option for unplanned gigs
- **Quick-create fields**: Name, venue, date, city (4 required fields)
- **Multi-device**: Single device for v1, but architecture must not block multi-device support later
- **Concert close**: Explicit "Close Concert" button triggers final sync and shows totals-only summary (total revenue, number of transactions, items sold)
- **Concert reopen**: Claude's discretion on whether to allow reopening closed concerts
- **Auto-resume active concert**: Claude's discretion on whether to auto-resume the last active concert on app open

### Auth & App Entry

- **Login method**: PIN only (4-6 digit numeric). Fast one-handed entry for concert environment
- **Session duration**: 24-hour JWT expiry
- **Accounts**: Single admin account (shared PIN)
- **Offline login**: Always allowed — PIN cached locally securely after first setup
- **No lockout**: Unlimited PIN attempts. Just "Wrong PIN, try again"
- **Home screen**: Dashboard with quick action cards after login

### Dashboard Quick Actions

- Start/resume selling (primary action)
- Concert management (view/create/close concerts)
- Sync status indicator (online/offline/pending)
- Stock overview (per-product, per-variant quantities)
- Needs reproduction (items with negative stock deficit, red badge with count)
- Restock (navigate to separate restock screen)
- Transaction history
- Manage products (full CRUD)

### Offline Strategy & Sync

- **Concert sales never rejected**: Sales always go through regardless of stock levels. If stock goes negative, items appear in "Needs Reproduction" screen showing what to reorder before fulfilling online orders
- **Sync trigger**: Auto sync in background when connectivity detected
- **Offline indicator**: Small icon in corner that changes color (online/offline). Minimal, not a full status bar
- **Catalog caching**: Product names and prices cached locally. No images stored offline (placeholder icons when offline)
- **Local stock tracking**: Optimistic local update — stock count decreases immediately on offline sale
- **Data persistence**: Every sale written to local storage immediately on confirmation. Survives app crashes and phone restarts
- **Sync errors**: Silent retry, alert only after 3 consecutive failures. Doesn't interrupt selling
- **Cold start without API**: Claude's discretion on handling first-ever launch without connectivity

### Navigation Structure

- **Bottom tab bar** with 4 tabs: Dashboard, History, Stock, Settings
- **Selling mode**: Tab bar replaced by cart bar. Back arrow in top-left to exit selling mode and restore tab navigation
- **Restock access**: Button on stock screen + dashboard quick action (two entry points)
- **Gestures**: Standard system back gesture only, no custom swipe actions
- **Back from selling mode**: Claude's discretion on whether back goes to dashboard or concert detail

### Transaction History

- **Organization**: Grouped by concert (headers), chronological within each concert (newest first)
- **Sale detail**: Tap to open full breakdown — all items with quantities, prices, variant info, discount, total, payment method, currency, timestamp, and Void/Unvoid button
- **Filtering**: Filter by concert only (dropdown)
- **Voided sales**: Visible in list with "VOIDED" badge, can be unvoided

### Stock Overview

- **Layout**: Expandable product rows — collapsed shows product name + total stock, tap to expand per-variant breakdown
- **Low stock display**: No special highlighting or sorting — just plain numbers
- **Restock**: Separate screen (not inline on stock overview) to prevent misclicks. Accessible from stock screen button + dashboard
- **Refresh**: Auto-refresh on screen open + pull-to-refresh

### Product Management

- **Access**: Dashboard quick action "Manage Products"
- **Capabilities**: Full CRUD — add, edit, deactivate products from the app
- **New product fields**: Name, price, variants (size/color/SKU/price adjustment), and image upload
- **Deletion**: Deactivate only (hidden from sales grid, preserved for historical records)
- **Connectivity**: Requires internet — product changes are not queued offline

### App Appearance

- **Orientation**: Portrait only
- **Language**: Bilingual French/English with toggle
- **Theme**: Dark/light mode switch
- **Layout**: Follow current mobile UI trends (Claude's discretion on specifics)

### Error Handling

- **Sync failures**: Silent retry, alert after 3 consecutive failures
- **Login failures**: No lockout, unlimited PIN attempts
- **Cold start offline**: Claude's discretion

### Notifications (In-App Only)

- No push notifications in v1
- Sale confirmation toast (brief success message)
- Sync complete toast ("X sales synced")
- Session expiry warning (alert 30 minutes before JWT expires)
- Sync error alert (after 3 consecutive failures)

### Claude's Discretion

- Concert reopen policy
- Auto-resume active concert behavior
- Cold-start offline handling
- Dashboard layout and card arrangement
- Back-navigation from selling mode (dashboard vs concert detail)
- Loading states, skeleton screens, error state design
- Exact spacing, typography, and color palette
- Progress bar/spinner implementations

</decisions>

<specifics>
## Specific Ideas

- Grid tiles must show per-variant stock counts directly — "total items" without variant breakdown is not useful when quickly checking availability
- Restock screen must be separate from stock overview to avoid misclicks
- "Needs Reproduction" dashboard card must have a red badge showing count of deficit items
- Cart bar replaces tab bar during selling (not both visible simultaneously) to maximize screen real estate
- Currency is per-sale, not per-concert — can take cash in GBP and card in EUR at same event
- Concert sales always go through — never reject a sale. Track the deficit instead

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/routes/auth.js`: JWT authentication with bcrypt — mobile PIN auth will extend this
- `api/routes/products.js`: Product CRUD endpoints — mobile app consumes these
- `api/routes/inventory.js`: Reserve, release, deduct, restock, stock summary endpoints — mobile sync targets these
- `api/models/Product.js`: Product schema with embedded variants (sku, stock, version, size, color, priceAdjustment)
- `api/models/Sale.js`: Sale model linked to Concert — mobile sales records use this
- `api/models/Concert.js`: Concert model (name, date, location, active status)
- `api/models/InventoryAdjustment.js`: Audit trail for stock changes
- `api/middleware/auth.js`: JWT verification middleware (authenticateToken)

### Established Patterns
- Optimistic locking with per-variant version field for concurrent stock updates
- Explicit field whitelisting for PUT operations (allowedProductFields, allowedVariantFields)
- TDD with Jest + Supertest for API endpoints
- CommonJS modules in API

### Integration Points
- Mobile app will consume existing REST API endpoints
- New API endpoints needed: sales creation with offline queue sync, concert CRUD, PIN-based auth
- Sale model needs concert_id reference (exists in schema)
- Stock deduction on sale sync follows existing inventory patterns

</code_context>

<deferred>
## Deferred Ideas

- Multi-device concurrent selling at same concert — future enhancement after v1
- Push notifications — not in v1
- Data export (CSV/PDF reports) — future phase
- Card reader hardware integration — explicitly out of scope
- Per-item discounts — v1 supports whole-sale discount only
- Product image storage/CDN strategy — needs research during planning

</deferred>

---

*Phase: 02-mobile-pos-core*
*Context gathered: 2026-03-14*
