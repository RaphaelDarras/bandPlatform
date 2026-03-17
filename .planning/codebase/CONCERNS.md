# Codebase Concerns

**Analysis Date:** 2026-02-13

## Project Status

**Current State:** Pre-development planning phase

This is a greenfield project with architectural roadmap documented in `roadmap.md` but no implementation code yet. Below are concerns identified from the project plan that should be addressed during development.

---

## Critical Technical Debt Areas

### Stock Management Concurrency

**Issue:** Distributed stock management across Orders (e-shop) and Sales (concerts) creates race condition risks

**Files (planned):**
- `api/models/Products.ts` (not yet created)
- `api/services/inventory.ts` (not yet created)
- `api/routes/orders.ts` (not yet created)
- `api/routes/sales.ts` (not yet created)

**Impact:**
- Overselling merchandise if concurrent requests hit simultaneously
- Stock inconsistency between e-shop and concert sales
- Financial losses and inventory mismatches
- Customer frustration from unfulfilled orders

**Current Risk:** HIGH - This is identified as critical in roadmap (Section 1, line 82: "Transactions MongoDB pour éviter les conflits")

**Fix approach:**
1. Implement MongoDB transactions at the database layer for all stock-affecting operations
2. Use atomic update operations with quantity checks
3. Create transaction wrapper for Order creation + stock deduction
4. Create transaction wrapper for Sale creation + stock deduction
5. Add audit logging to Inventory collection for every stock change
6. Implement optimistic locking strategy if transactions insufficient

---

## Security Vulnerabilities

### Payment Integration Security

**Risk:** Stripe and PayPal integration planned without clear security controls

**Planned Files:**
- `api/routes/payments.ts` (not yet created)
- `web/components/CheckoutForm.tsx` (not yet created)
- `api/services/stripe.ts` (not yet created)
- `api/services/paypal.ts` (not yet created)

**Current Mitigation:** None (feature in Phase 5)

**What could go wrong:**
- Payment intent IDs exposed in frontend logs
- Webhook signature verification skipped or incorrectly implemented
- Sensitive payment data stored in Orders collection
- Client-side card handling without proper PCI compliance
- Stripe key leakage through environment configuration
- Webhook URL guessing/spoofing attacks

**Recommendations:**
1. Store ONLY payment references (payment_intent_id, transaction_id) in Orders collection, never card data
2. Implement strict webhook signature verification using `stripe.webhooks.constructEvent()`
3. Use Stripe Elements (not raw form inputs) to handle PCI compliance
4. Store Stripe secret key ONLY in backend `.env` file, never expose to frontend
5. Implement webhook request ID deduplication to prevent replay attacks
6. Add rate limiting on payment endpoints (10 requests/minute per IP)
7. Use HTTPS everywhere with HSTS headers configured
8. Validate webhook source IP against Stripe's documented ranges

---

### JWT Authentication Weakness

**Risk:** JWT implementation in mobile app for admin access planned but approach undefined

**Planned Files:**
- `mobile/screens/LoginScreen.tsx` (not yet created)
- `api/middleware/auth.ts` (not yet created)
- `api/routes/auth.ts` (not yet created)

**Current Mitigation:** None (feature in Phase 1, week 4)

**What could go wrong:**
- No token expiration causing indefinite access if phone stolen
- No refresh token rotation
- JWT secret hardcoded or weak
- No logout endpoint (tokens can't be revoked)
- Admin credentials stored insecurely on mobile device
- No rate limiting on login attempts (brute force possible)

**Recommendations:**
1. Set short JWT expiration (15-30 minutes maximum)
2. Implement refresh token flow with separate long-lived token
3. Generate strong random JWT secret with `crypto.randomBytes(32)`
4. Implement logout endpoint that invalidates tokens (Redis blacklist or JWT version tracking)
5. Store refresh tokens securely in mobile device keychain (React Native secure storage)
6. Add rate limiting on `/auth/login` endpoint (5 attempts/15 minutes)
7. Log all admin access for audit trail

---

### API Endpoint Protection Gap

**Risk:** Routes for sensitive operations (Sales, Inventory, Concert management) require authentication

**Planned Files:**
- `api/routes/sales.ts` (not yet created)
- `api/routes/concerts.ts` (not yet created)
- `api/routes/inventory.ts` (not yet created)

**Current Mitigation:** Not implemented yet

**What could go wrong:**
- Unauthenticated users creating fake sales records
- Concert data being modified by non-admin users
- Inventory logs manipulated to hide stock discrepancies
- Unlimited access to sales data (GDPR/privacy violation)

**Recommendations:**
1. Require JWT authentication on ALL routes except public GET for Products and Orders
2. Implement role-based access control (admin vs public)
3. Add authorization check: `if (!user || user.role !== 'admin') { return 403 }`
4. Protect POST/PUT/DELETE on Concerts, Sales, Inventory behind admin middleware
5. Add request validation middleware using Joi or Zod
6. Log all admin actions with user ID and timestamp

---

## Performance Bottlenecks

### Stock Inventory Query Performance

**Problem:** Real-time stock availability must be fetched frequently (product listing, checkout validation)

**Planned Files:**
- `api/routes/products.ts` (not yet created)
- `api/services/inventory.ts` (not yet created)

**Cause:** Without proper indexing, calculating available stock requires:
1. Fetch Product document
2. Count all Orders with that product_id (JOIN operation)
3. Count all Sales with that product_id (JOIN operation)
4. Subtract from stock_actuel to get available

**Improvement path:**
1. Denormalize stock_actuel directly in Products collection
2. Update Products.stock_actuel in transactions (one atomic operation)
3. Add MongoDB index: `db.products.createIndex({ stock_actuel: 1 })`
4. Cache stock for 5-10 seconds using Redis if hitting API hard
5. Avoid N+1 queries: fetch all products with aggregation pipeline

---

### E-shop Product Listing Unoptimized

**Problem:** Website displaying merch catalog will repeatedly query all products

**Planned Files:**
- `web/pages/Shop.tsx` (not yet created)
- `api/routes/products.ts` (not yet created)

**Cause:** No pagination planned, no caching, no image optimization

**Improvement path:**
1. Implement pagination: `GET /products?page=1&limit=20`
2. Add MongoDB query limit to prevent loading 1000s of products
3. Cache product list for 1 hour using Redis
4. Implement image CDN (Cloudinary) with compression
5. Use React query or SWR for frontend caching
6. Add ETags or Last-Modified headers for efficient caching

---

### Mobile App Real-time Sync Latency

**Problem:** Concert sales interface needs stock to stay current during sales

**Planned Files:**
- `mobile/screens/SalesScreen.tsx` (not yet created)
- `mobile/services/api.ts` (not yet created)

**Cause:** Only polling-based updates (no websockets), network latency on 4G

**Improvement path:**
1. Implement WebSocket connection for real-time updates (Socket.io or GraphQL subscriptions)
2. Fall back to polling every 5 seconds if WebSocket unavailable
3. Implement optimistic UI updates (assume operation succeeds, rollback on error)
4. Cache concert sales locally on device
5. Queue sales for upload when offline, sync when reconnected

---

## Fragile Areas

### Database Schema Flexibility Risk

**Files:** `api/models/` (not yet created)

**Why fragile:** MongoDB schema defined in Mongoose allows optional fields, but business logic may assume required fields

**Safe modification:**
1. Define ALL required fields with `required: true` in Mongoose schemas
2. Add pre-save hooks to validate relationships (concert_id actually exists)
3. Use schema validation even though MongoDB is schemaless
4. Document required vs optional fields in comments

**Test coverage gaps:**
- No validation tests for missing required fields
- No tests for invalid references (Order pointing to non-existent product)
- No tests for concurrent updates causing schema violations

---

### Payment Processing Integration Points

**Files:** `api/routes/orders.ts`, `api/services/stripe.ts`, `api/services/paypal.ts` (not yet created)

**Why fragile:** Multiple async operations must succeed in sequence:
1. Create Order in DB
2. Create Payment Intent with Stripe
3. Receive webhook confirmation
4. Update Order.statut_paiement to 'paid'
5. Deduct stock
6. Create Inventory log

**Safe modification:**
1. Create comprehensive integration tests with webhook simulation
2. Implement idempotency keys in Stripe requests
3. Add explicit state machine for Order status (pending → processing → paid → fulfilled)
4. Store stripe_payment_intent_id immediately after creation
5. Log each step of payment flow with timestamp

**Test coverage gaps:**
- No tests for webhook arriving before Order creation completes
- No tests for partial failures (Stripe succeeds, DB write fails)
- No tests for duplicate webhook delivery
- No tests for timeout scenarios

---

### Mobile App Build & Distribution Risk

**Files:** `mobile/` (not yet created)

**Why fragile:** Android APK build process is complex, certificate management error-prone

**Safe modification:**
1. Store signing keystore in secure location, NEVER in git
2. Document keystore password in secure password manager
3. Test APK build process weekly to catch breakage early
4. Version APK builds (v1.0.0-beta.1 format)
5. Keep changelog of APK versions distributed

**Test coverage gaps:**
- No tests for app startup without internet
- No tests for app behavior when API becomes unreachable
- No tests for invalid JWT during app session
- No E2E tests for full sales flow on real device

---

## Scaling Limits

### Database Growth

**Current Capacity:** MongoDB Atlas free tier = 512MB

**Limit:** Approximately:
- 100,000 Products at 5KB average
- 500,000 Orders at 1KB average
- 10,000 Concerts at 0.5KB average
- 50,000 Sales at 1KB average
- 1,000,000 Inventory logs at 0.5KB average

**Problem:** Once database exceeds 512MB, free tier stops accepting writes

**Scaling path:**
1. Monitor database size monthly using MongoDB Atlas UI
2. Archive old Inventory logs (>1 year) to separate collection
3. When approaching 400MB, upgrade to M0 shared tier (1GB, still free)
4. Implement data retention policy: delete Inventory logs older than 2 years
5. Consider denormalization: pre-calculate concert totals instead of querying all sales

---

### API Request Volume

**Current Capacity:** Backend on Render/Railway free tier (shared resources)

**Limit:** Approximately 100-500 requests/minute depending on operation complexity

**Problem:** Black Friday sales event could overwhelm free tier

**Scaling path:**
1. Add response caching (Redis) for GET /products, GET /concerts
2. Implement request queuing for intensive operations
3. Add rate limiting per IP address (100 requests/minute)
4. Monitor response time metrics weekly
5. When average response time exceeds 500ms, upgrade to paid tier
6. Implement database connection pooling

---

### Frontend Static Asset Delivery

**Current Capacity:** Vercel/Netlify free tier sufficient for typical traffic

**Limit:** 100GB/month bandwidth included

**Problem:** Large product images could consume bandwidth quickly

**Scaling path:**
1. Optimize images: use WebP format with fallback to JPEG
2. Implement lazy loading for below-fold product images
3. Use image CDN (Cloudinary free tier) for on-the-fly resizing
4. Set image dimensions in HTML to prevent layout shift
5. Monitor bandwidth usage in Vercel analytics

---

## Dependencies at Risk

### Stripe SDK Binding

**Risk:** Tight coupling to Stripe-specific payment flow

**Impact:** Switching to PayPal-only or adding new payment method requires significant refactoring

**Migration plan:**
1. Create abstraction layer: `PaymentProcessor` interface with `createPayment()`, `confirmPayment()`, `handleWebhook()`
2. Implement `StripeProcessor extends PaymentProcessor`
3. Inject processor into routes: `const processor = new StripeProcessor()`
4. If switching payment provider, implement new processor class without touching routes

---

### MongoDB Mongoose ODM Lock-in

**Risk:** Mongoose-specific code (virtuals, hooks, methods) prevents switching to raw MongoDB driver

**Migration plan:**
1. Keep models simple: avoid Mongoose virtuals and complex hooks
2. Write business logic outside models (services layer)
3. If switching: migrate to `mongodb` package directly (same query syntax)
4. Keep validation in separate layer, not tied to Mongoose

---

### React Native Expo Dependency

**Risk:** Expo build service may change pricing, discontinue free tier, or limit features

**Impact:** Cannot easily switch to bare React Native workflow

**Migration plan:**
1. Document all Expo-specific features (EAS Build, updates, etc.)
2. Keep app simple enough to eject to bare React Native if needed
3. Use only cross-platform APIs (avoid Expo-specific modules where possible)
4. Maintain ability to build APK locally using Android Studio as backup

---

## Missing Critical Features

### Offline Support in Mobile App

**Problem:** No mechanism for handling offline sales (network failure during concert)

**Blocks:**
- Sales data entry continues but can't sync to server
- Stock information becomes stale
- No warning to user that offline

**Recommendation:**
1. Implement local SQLite database for offline queue
2. Show "Offline" indicator when no connection
3. Queue sales operations: `sales.pending = [{ items, total, timestamp }]`
4. Auto-sync when connection restored
5. Merge local stock updates with server version (conflict resolution)

---

### Email Confirmation Notifications

**Problem:** No email sent to customers after order placement or payment

**Blocks:**
- Customer confusion about order status
- No order receipt
- No password reset mechanism if JWT gets lost

**Recommendation:**
1. Add Nodemailer configuration in API
2. Send email after Order creation with details
3. Send confirmation when payment completes
4. Create simple email templates (HTML)
5. Add email validation in order creation endpoint

---

### Admin Dashboard

**Problem:** No way for admin to see orders, sales, or revenue without direct database access

**Blocks:**
- Cannot track daily/weekly sales
- Cannot see which products sell best
- Cannot analyze customer orders
- Risk of manual database corruption

**Recommendation:**
1. Create simple admin web interface (separate from public site)
2. Dashboard showing: daily sales, top products, revenue graph
3. Orders list with filtering (date range, payment status)
4. Concert management (add/edit/delete events)
5. Inventory adjustment interface
6. Protect with admin JWT login

---

### Inventory Recount & Discrepancy Handling

**Problem:** No mechanism to handle physical count mismatches (shoplifting, miscounts)

**Blocks:**
- Stock records drift from reality over time
- Cannot reconcile after physical inventory check
- Financial losses not tracked

**Recommendation:**
1. Add "inventory adjustment" endpoint for manual corrections
2. Require reason + admin comment for adjustments
3. Log all adjustments in Inventory collection with type: "adjustment"
4. Create report: expected vs actual stock
5. Implement quarterly inventory check workflow

---

## Test Coverage Gaps

### No Testing Infrastructure Yet

**Current:** `package.json` test script: `"test": "echo \"Error: no test specified\" && exit 1"`

**What's not tested (planned but untested):**

**Inventory Stock Deduction Logic:**
- Files: `api/services/inventory.ts`, `api/routes/orders.ts`, `api/routes/sales.ts`
- Specific gaps:
  - Order creation with insufficient stock (should reject)
  - Concurrent orders for last remaining item (should reject 1)
  - Sale creation without concert (should reject)
  - Stock never going negative
  - Inventory logs created for every deduction
- Risk: Overselling, inventory corruption
- Priority: **HIGH**

**Payment Webhook Processing:**
- Files: `api/routes/webhooks.ts` (not yet created)
- Specific gaps:
  - Stripe webhook with invalid signature (should reject)
  - Duplicate webhook delivery (should be idempotent)
  - Webhook for non-existent Order (should not crash)
  - Payment succeeded but stock already sold (should handle gracefully)
  - Webhook timeout then retry (should not double-process)
- Risk: Double-charging, inventory corruption, payment status mismatch
- Priority: **HIGH**

**Authentication & Authorization:**
- Files: `api/middleware/auth.ts`, mobile login screen
- Specific gaps:
  - Invalid JWT token should reject request
  - Expired JWT should require fresh login
  - Non-admin user accessing admin routes (should 403)
  - Logout invalidates token
  - Login rate limiting prevents brute force
- Risk: Unauthorized access to sensitive operations
- Priority: **HIGH**

**Mobile App Integration:**
- Files: `mobile/services/api.ts`, `mobile/screens/SalesScreen.tsx`
- Specific gaps:
  - App handles API error responses gracefully
  - Stock updates displayed correctly after sale
  - Sale creation without internet (should queue or fail gracefully)
  - Concurrent sales on multiple devices for same concert
  - Login session persistence across app restart
- Risk: User data loss, bad UX, untracked sales
- Priority: **MEDIUM**

**E-shop Purchase Flow:**
- Files: `web/pages/CheckoutPage.tsx`, `api/routes/orders.ts`
- Specific gaps:
  - Product stock decreases as user adds to cart (race condition)
  - Checkout with empty cart (should reject)
  - Order creation without payment succeeding (should not happen)
  - User session loss during payment (should resume)
  - Product price changed during checkout (should re-validate)
- Risk: Data inconsistency, customer frustration
- Priority: **MEDIUM**

---

## Recommendations for Phased Mitigation

**Before Phase 1 Complete (4 weeks):**
- Implement MongoDB transaction wrapper for stock operations
- Add comprehensive input validation middleware
- Set up linting (ESLint) and formatting (Prettier)
- Create Jest test suite structure

**Before Phase 2 Complete (8 weeks):**
- Add all inventory logic tests (stock deduction, concurrent updates)
- Implement JWT authentication with 30-minute expiration
- Add admin login rate limiting
- Write integration tests for all CRUD endpoints

**Before Phase 5 Complete (19 weeks):**
- Implement webhook signature verification for Stripe
- Add webhook idempotency key handling
- Write comprehensive payment flow tests
- Add PCI compliance for card handling

**Before Production Deployment (22 weeks):**
- Complete test coverage: minimum 80% for critical paths
- Security audit: JWT, webhooks, payment handling
- Load test: concurrent stock operations
- Data retention policy: archive old logs
- Backup strategy: daily MongoDB backup
- Error monitoring: Sentry or similar for production bugs

---

*Concerns audit: 2026-02-13*
