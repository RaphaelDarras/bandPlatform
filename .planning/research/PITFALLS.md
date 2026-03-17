# Pitfalls Research

**Domain:** E-commerce with Multi-Channel Inventory Management
**Researched:** 2026-02-13
**Confidence:** HIGH (based on established patterns in payment processing, distributed systems, and inventory management)

## Critical Pitfalls

### Pitfall 1: Race Conditions on Inventory Deduction

**What goes wrong:**
Multiple concurrent transactions attempt to purchase the same item(s), leading to overselling. Customer A and Customer B both purchase the last item in stock simultaneously — both transactions succeed but only one item exists. This is especially critical during high-traffic events like concert on-sale dates.

**Why it happens:**
- Checking stock availability and deducting inventory are separate operations (read-then-write pattern)
- MongoDB transactions not properly configured with write concerns
- Mobile POS and online store operate on different database connections without proper locking
- Optimistic locking not implemented or incorrectly configured
- "Check available stock" query runs without holding a lock

**How to avoid:**
1. Use MongoDB transactions with `readConcern: "snapshot"` and `writeConcern: { w: "majority" }`
2. Implement optimistic concurrency control using version numbers on inventory documents
3. Use atomic operations: `findOneAndUpdate` with `$inc: { quantity: -N }` and filter `{ quantity: { $gte: N } }`
4. Reserve inventory first (temporary hold), then confirm after payment
5. Implement idempotency keys for all inventory operations

**Warning signs:**
- Customer complaints about "out of stock" after successful payment
- Negative inventory quantities in database
- Discrepancies between physical inventory counts and system inventory
- Multiple successful orders with timestamps within milliseconds of each other for low-stock items

**Phase to address:**
Phase 1 (Core Data Model) — Must be architected correctly from the start. Retrofitting proper concurrency control is extremely difficult and risky once live transactions exist.

---

### Pitfall 2: Webhook Failure Handling (Payment Confirmed but Order Not Fulfilled)

**What goes wrong:**
Stripe/PayPal webhook delivers payment confirmation, but your endpoint fails to process it (server down, database timeout, bug in handler). Payment succeeds but order never gets marked as paid. Customer charged, no product delivered. Money is captured but inventory isn't allocated.

**Why it happens:**
- Webhook handlers not idempotent — processing the same webhook twice causes errors
- No retry mechanism for failed webhook processing
- Webhook verification skipped or incorrectly implemented (security bypass attacks)
- Database transactions fail midway through webhook processing
- Webhook endpoint times out before completing (Stripe has 5-second timeout)
- No separate queue for webhook processing — handlers block on slow operations

**How to avoid:**
1. Always verify webhook signatures (Stripe: `stripe.webhooks.constructEvent`, PayPal: verify headers)
2. Store webhook events immediately in a `webhook_events` collection with status tracking
3. Process webhooks asynchronously: receive → store → return 200 → process in background
4. Make handlers idempotent using `payment_intent.id` or `transaction_id` as deduplication key
5. Implement exponential backoff retry for failed webhook processing
6. Use MongoDB transactions to ensure atomic updates (payment status + inventory + order fulfillment)
7. Monitor webhook delivery health via Stripe Dashboard webhook logs

**Warning signs:**
- Stripe Dashboard shows webhook delivery failures (4xx/5xx responses)
- Gap between payment timestamp and order fulfillment timestamp > 1 minute
- Manual reconciliation needed between Stripe balance and order revenue
- Customer support tickets: "charged but order not confirmed"

**Phase to address:**
Phase 2 (Payment Integration) — Critical to implement correctly during payment system development. Cannot defer to "later improvement" — financial discrepancies compound quickly.

---

### Pitfall 3: Mobile Offline Sync Conflicts (Last-Write-Wins Data Loss)

**What goes wrong:**
Mobile POS records a sale offline. Online store simultaneously sells the same item. When mobile comes online, one sale is lost or inventory becomes negative. Band sells merch at concert (offline mode), fan buys same item online during concert, both transactions succeed but only one item exists.

**Why it happens:**
- Naive last-write-wins conflict resolution
- No vector clocks or causal ordering for sync operations
- Mobile app directly writes to production database when reconnecting
- Inventory reserved but not committed during offline period
- No conflict detection mechanism between channels

**How to avoid:**
1. Use operation-based CRDTs (Conflict-free Replicated Data Types) for inventory adjustments
2. Implement offline operation log on mobile: record operations (not final state)
3. On reconnect, replay operations through server validation layer (don't sync raw state)
4. Server-side conflict detection: if inventory changed since mobile went offline, flag for reconciliation
5. Reserve inventory pessimistically when mobile goes offline (if feasible), release after timeout
6. Implement manual conflict resolution UI for staff: "Mobile sold 3, online sold 2, only 4 exist — choose action"
7. Use timestamp + device_id + sequence_number for operation ordering

**Warning signs:**
- Inventory discrepancies appearing after events with mobile POS usage
- Negative inventory values after mobile devices sync
- Duplicate order IDs or transaction collisions
- Customer complaints about double-charging or unfulfilled orders after live events

**Phase to address:**
Phase 3 (Mobile POS Offline Mode) — Must be designed during mobile architecture phase. Conflict resolution cannot be added as an afterthought; requires fundamental sync architecture decisions.

---

### Pitfall 4: Webhook Replay Attacks (Missing Idempotency)

**What goes wrong:**
Attacker captures legitimate Stripe webhook and replays it multiple times. System processes duplicate webhooks as separate payments. Single payment credited multiple times, inventory over-deducted, or digital goods delivered repeatedly.

**Why it happens:**
- No deduplication of webhook event IDs
- Webhook signature verification missing or bypassable
- Idempotency keys not checked before processing
- Event ID stored but not queried before processing
- Race condition: same webhook processed simultaneously by multiple server instances

**How to avoid:**
1. Store `event.id` in database with unique index constraint
2. Insert event record first (will fail if duplicate due to unique constraint), then process
3. Use upsert with `updateOne({ event_id: X }, { $setOnInsert: { ... } })`
4. Always verify webhook signatures before processing
5. Use distributed locking (Redis) for webhook processing if multiple servers handle webhooks
6. Set webhook event retention: archive processed events after 30 days

**Warning signs:**
- Duplicate orders with identical payment intent IDs
- Single customer charged once but multiple order records exist
- Inventory deducted multiple times for single sale
- Audit logs show identical webhook payload processed multiple times

**Phase to address:**
Phase 2 (Payment Integration) — Must be implemented when webhook handlers are first built. Idempotency is not a feature addition; it's fundamental security.

---

### Pitfall 5: Inventory Reservations Without Expiry (Cart Abandonment Deadlock)

**What goes wrong:**
User adds items to cart, inventory is reserved, user never completes checkout. Inventory locked indefinitely. During high-demand sales (concert merch drops), legitimate buyers see "out of stock" while ghost carts hold inventory.

**Why it happens:**
- Reservations created without TTL (time-to-live)
- No background job to release expired reservations
- Reservation extended indefinitely on every cart update
- Payment initiation reserves stock but never releases on payment failure

**How to avoid:**
1. Implement reservation expiry: 15 minutes for cart, 10 minutes after payment initiation
2. Use MongoDB TTL index on reservation collection: `{ createdAt: 1 }, { expireAfterSeconds: 900 }`
3. Background job runs every 5 minutes to release expired reservations
4. On payment failure webhook, immediately release reservation
5. Don't reserve inventory on "add to cart" — only reserve when checkout initiated
6. Display countdown timer to user: "Items reserved for 12:34"

**Warning signs:**
- Available inventory decreasing without corresponding completed orders
- High abandoned cart rate correlating with inventory shortages
- Manual inventory corrections needed frequently
- Customers reporting items showing as available but failing at checkout

**Phase to address:**
Phase 1 (Core Data Model) — Reservation architecture must be designed into data model. Later addition requires migration of existing order/cart logic.

---

### Pitfall 6: Payment Webhook Ordering (Out-of-Order Event Processing)

**What goes wrong:**
Webhooks arrive out of order: `payment_intent.succeeded` processed before `payment_intent.created`. Order fulfillment triggered before order record exists. Or `charge.refunded` processed before `charge.succeeded`, causing state machine errors.

**Why it happens:**
- Webhook delivery is not guaranteed to be ordered
- Network retries cause later events to arrive first
- Multiple webhook endpoints or servers process events in parallel
- Event handlers assume chronological processing
- No event versioning or causal dependency tracking

**How to avoid:**
1. Don't rely on webhook arrival order — design event handlers to be order-independent
2. Use Stripe API to fetch current state when processing events (source of truth)
3. Implement event reordering buffer: hold events until dependencies satisfied
4. Use state machines with valid transitions: can't transition to "refunded" unless currently "succeeded"
5. Store all events, process idempotently, allow reprocessing in correct order if needed
6. For critical state changes, poll Stripe API to confirm (webhook as notification, API as truth)

**Warning signs:**
- Order fulfillment errors during webhook processing
- State machine invalid transition errors in logs
- Orders stuck in "processing" state after payment succeeded
- Refunds processed before initial payment recorded

**Phase to address:**
Phase 2 (Payment Integration) — Implement during webhook handler development. Order-dependent logic must be avoided from the start.

---

### Pitfall 7: Multi-Channel Inventory Sync Lag (Stock Shows Available but Isn't)

**What goes wrong:**
Online store shows item in stock. Customer orders. Fulfillment fails because inventory was sold via mobile POS 2 minutes ago but sync hasn't completed. Customer frustrated by "bait and switch" experience.

**Why it happens:**
- Polling-based sync instead of event-driven updates
- Mobile POS syncs inventory changes every N minutes instead of immediately
- Inventory displayed from stale cache
- No real-time inventory updates to frontend
- Different channels query different database replicas with replication lag

**How to avoid:**
1. Event-driven architecture: inventory change triggers immediate push to all channels
2. Use WebSockets or Server-Sent Events to push inventory updates to online store frontend
3. Mobile POS sends inventory changes immediately when network available (queue when offline)
4. Implement "available to promise" (ATP) inventory: show only immediately available stock
5. Add safety margin: show "in stock" only if quantity >= 2 (buffer for sync lag)
6. MongoDB change streams to propagate inventory updates in real-time
7. Display last-sync timestamp on mobile POS: "Last synced: 30 seconds ago"

**Warning signs:**
- High rate of order cancellations due to "out of stock after order"
- Customer complaints about inaccurate stock displays
- Frequent sync conflicts between channels
- Mobile POS showing different stock counts than online store for extended periods

**Phase to address:**
Phase 3 (Multi-Channel Sync) — Must be architected during sync system design. Real-time propagation cannot be easily retrofitted onto polling-based systems.

---

### Pitfall 8: MongoDB Transaction Timeout During High Traffic

**What goes wrong:**
During concert on-sale or merch drop, transaction traffic spikes. MongoDB transactions timeout or abort due to write conflicts. Users see "Order failed, please try again" errors. Revenue lost due to failed transactions during peak demand.

**Why it happens:**
- Long-running transactions holding locks during slow operations (external API calls inside transaction)
- Write conflicts due to hot documents (everyone updating same inventory document)
- Insufficient connection pool size for transaction volume
- Transactions not properly tuned for write concern and read concern
- No retry logic for transient transaction failures

**How to avoid:**
1. Keep transactions short: only include database operations, no external API calls
2. Use granular inventory documents: one document per SKU instead of single inventory document
3. Implement exponential backoff retry for transaction conflicts (MongoDB error code 112)
4. Increase connection pool size: `maxPoolSize: 100` or higher for high traffic
5. Use `writeConcern: { w: "majority", wtimeout: 5000 }` to fail fast instead of hanging
6. Implement circuit breaker: if transaction failure rate > 10%, queue orders for delayed processing
7. Pre-reserve inventory before starting payment to reduce transaction scope
8. Use two-phase commit pattern: reserve → confirm/release

**Warning signs:**
- Transaction timeout errors in logs during traffic spikes
- "WriteConflict" or "TransactionTooLargeForCache" MongoDB errors
- Order success rate drops during high-traffic periods
- Connection pool exhaustion warnings
- User-reported checkout failures during specific time windows

**Phase to address:**
Phase 1 (Core Data Model) + Load Testing before launch — Transaction architecture must be correct from start, but performance characteristics discovered during load testing.

---

### Pitfall 9: Payment Fraud Detection Too Strict (False Positives Block Legitimate Sales)

**What goes wrong:**
Fraud detection rules too aggressive: legitimate customers' payments declined. Band fan traveling to concert flagged as "unusual location". High-value merch order flagged as suspicious. Revenue lost, customer frustrated, customer support overload.

**Why it happens:**
- Default Stripe Radar rules not tuned for domain (concerts inherently have unusual patterns)
- No manual review queue for flagged transactions
- Geo-blocking rules don't account for fans traveling to events
- Velocity checks too strict (many orders during on-sale window looks like fraud)
- No customer communication when payment blocked

**How to avoid:**
1. Tune Stripe Radar rules for concert/event context: expect location diversity, velocity spikes
2. Implement manual review queue for high-value transactions instead of auto-decline
3. Allow-list known fan email addresses or repeat customers
4. Communicate with customer when payment flagged: "Verification needed" not silent failure
5. Implement step-up authentication: request additional verification instead of declining
6. Monitor false positive rate: track "payment declined" → "customer support contact" → "legitimate customer"
7. Adjust rules based on event calendar: relax velocity checks during known on-sale windows

**Warning signs:**
- High payment decline rate during ticket/merch on-sale
- Customer support tickets: "Payment declined but card works elsewhere"
- Legitimate customers trying multiple times and failing
- Revenue lower than expected during high-demand periods
- Stripe Radar blocking significant percentage of transactions

**Phase to address:**
Phase 2 (Payment Integration) + Ongoing tuning — Initial fraud rules configured during payment setup, but require continuous tuning based on actual patterns.

---

### Pitfall 10: Mobile Offline Queue Overflow (Data Loss During Long Events)

**What goes wrong:**
Band sells merch at multi-day festival. Mobile POS offline for extended period. Local transaction queue overflows or app crashes. Sales data lost. Revenue and inventory records incomplete.

**Why it happens:**
- No persistence of offline transaction queue (stored in memory only)
- No queue size limits or overflow handling
- App crashes lose queued transactions
- No periodic partial sync attempts
- Battery death or device issues without transaction backup

**How to avoid:**
1. Persist offline transaction queue to local SQLite database, not memory
2. Implement queue overflow handling: warn staff at 80% capacity, block new sales at 100%
3. Background sync attempts every 30 seconds when connectivity detected
4. Batch sync: send transactions in groups of 10, not all at once
5. Manual export capability: staff can export transactions to file for manual import
6. Multiple device redundancy: transactions logged on both POS device and staff phone
7. Transaction receipt includes offline ID: allows manual reconciliation if sync fails

**Warning signs:**
- Missing transactions discovered after events
- Inventory discrepancies after multi-day events
- Staff reporting app crashes during events
- Offline queue warning messages appearing
- Manual reconciliation needed after every event

**Phase to address:**
Phase 3 (Mobile POS Offline Mode) — Offline queue architecture is foundational to mobile POS reliability.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip MongoDB transactions, use sequential operations | Simpler code, faster development | Race conditions on inventory, data inconsistencies, overselling | NEVER — financial transactions require ACID guarantees |
| Skip webhook signature verification | Faster implementation | Security vulnerability, replay attacks, financial fraud | NEVER — webhook verification is critical security control |
| Polling-based inventory sync (every 5 minutes) | Simpler architecture, no WebSocket complexity | Stale inventory data, poor UX, overselling | Acceptable for MVP if clearly documented as known issue, but must be replaced before scale |
| Last-write-wins conflict resolution for offline sync | Simple logic, no manual resolution needed | Data loss, inventory errors, customer complaints | Only acceptable if offline mode rarely used (< 5% of transactions) |
| Store webhook events without processing status | Simpler data model | No visibility into failed webhooks, manual reconciliation needed | Acceptable only if webhook volume is very low (< 100/day) |
| Global inventory pool instead of channel-specific allocation | No complex allocation logic | Can't prioritize channels, online might sell all stock before event | Acceptable if all channels have equal priority and similar volume |
| Cart reservation on "add to cart" instead of at checkout | Better UX, users feel item is secured | Inventory locked by window shoppers, legitimate buyers see false shortages | Never for high-demand items; acceptable for abundant stock |
| Optimistic UI updates without server confirmation | Faster perceived performance | Mobile shows incorrect state if server rejects operation | Acceptable for non-critical updates (UI preferences), never for inventory/payments |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Webhooks | Processing webhook before verifying signature | Always verify signature first: `stripe.webhooks.constructEvent(body, sig, secret)` before any processing |
| Stripe Payment Intents | Not handling `requires_action` status (3D Secure) | Check payment_intent.status, return client_secret for additional authentication, poll or wait for webhook |
| PayPal Webhooks | Using transaction amount from webhook without verification | Always call PayPal API to verify transaction details, don't trust webhook payload alone |
| MongoDB Transactions | Calling external APIs inside transaction block | Keep transactions minimal: only DB operations. Call external APIs before or after transaction |
| MongoDB Change Streams | Not handling resume tokens for connection failures | Store resume tokens, reconnect with token to continue from last position, avoid missing events |
| Stripe Connect (if using for band payouts) | Not handling account disconnection | Implement webhook handler for `account.application.deauthorized`, have fallback payment method |
| Mobile app offline sync | Sending entire inventory state on reconnect | Send only delta (operations since last sync), use timestamps or version numbers for conflict detection |
| MongoDB replica set reads | Reading from secondary without read concern | Use `readConcern: "majority"` or read from primary for inventory queries to avoid stale reads |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Single inventory document for all SKUs | Transaction conflicts, timeouts during checkout | One document per SKU or product variant | > 10 concurrent checkouts |
| Loading entire order history on dashboard | Slow page loads, memory issues | Pagination, lazy loading, date range filters | > 1000 orders |
| No database indexes on inventory queries | Slow stock checks, full collection scans | Index on `sku`, compound index on `sku + variant` | > 500 products |
| Synchronous webhook processing | Webhook timeouts, payment provider marks endpoint as failing | Queue webhooks for async processing, return 200 immediately | > 50 orders/minute |
| Real-time inventory broadcast to all connected clients | WebSocket message storm, server overload | Debounce updates, send only to clients viewing affected product | > 100 concurrent users |
| MongoDB transactions without connection pooling | Connection exhaustion, transaction failures | Configure connection pool: `maxPoolSize: 100, minPoolSize: 10` | > 20 transactions/second |
| Mobile POS querying full inventory list on every screen | Slow app, excessive data transfer | Cache inventory locally, sync only changes via delta updates | > 200 SKUs |
| No rate limiting on checkout endpoint | DDoS vulnerability, bot attacks during high-demand sales | Implement rate limiting: 5 checkout attempts per user per minute | First bot attack or viral sale |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not verifying webhook authenticity | Attackers trigger fake payment confirmations, free orders | Always verify Stripe signature or PayPal headers before processing |
| Storing payment card details | PCI DSS compliance violations, massive liability | Use Stripe Elements or PayPal SDK, never store card numbers |
| Trusting client-side price calculations | Price manipulation, customers set their own prices | Always validate cart total server-side, never trust client-submitted amounts |
| No rate limiting on payment attempts | Carding attacks (testing stolen cards), fraud | Limit payment attempts: 3 failures per card per hour, CAPTCHA after 2 failures |
| Exposing full order details in public API | Customer privacy violation, competitor intelligence | Require authentication for order access, use order tokens not sequential IDs |
| Mobile POS with no device authentication | Stolen device can record fraudulent sales | Require PIN or biometric auth on app launch, device registration with server |
| Webhook endpoint accessible without authentication | Anyone can trigger webhook processing, replay attacks | Use webhook secrets, verify signatures, optionally add IP whitelist for payment provider IPs |
| No idempotency on payment operations | Double-charging customers, financial discrepancies | Use idempotency keys for all payment API calls, store and check before processing |
| Accepting negative quantities in inventory adjustments | Inventory manipulation, theft concealment | Validate all inventory operations: adjustment + current >= 0, log all changes with user ID |
| Session fixation on mobile POS | Unauthorized users inherit authenticated sessions | Regenerate session on login, implement automatic logout after inactivity |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback during payment processing | User clicks "Pay" multiple times, duplicate charges | Show loading state, disable button, display "Processing payment..." |
| Inventory decrements immediately on cart add | User adds item, browses for 20 minutes, item sold out, angry at checkout | Reserve inventory only at checkout initiation, show "1 left" warnings earlier |
| Silent payment failure | User thinks order succeeded, no confirmation, confusion | Always show explicit success/failure message, send confirmation email immediately |
| No offline indicator on mobile POS | Staff records sales thinking they're synced, surprises later | Clear "Offline Mode" banner, show queue count, display last sync time |
| Checkout fails without explanation | "Error processing order" — user doesn't know what to fix | Specific error messages: "Card declined", "Item out of stock", "Try different payment" |
| No stock notifications | User wants item, out of stock, user leaves forever | "Notify when back in stock" option, auto-email when available |
| Long checkout flow during high-demand sales | Users lose reservation during checkout, frustration | Express checkout option: store shipping/billing for logged-in users |
| No order confirmation accessible after purchase | User closes confirmation email, no record, anxiety | Order history in user account, resend confirmation option, order tracking link |
| Mobile POS requires internet for every action | Unusable at venues with poor connectivity, lost sales | Offline-first design: all POS functions work offline, sync when possible |
| No indication of payment processing time | User anxious during 3D Secure redirect, abandons | Show "Verifying with bank..." progress, estimate time remaining |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Payment integration:** Webhook handlers written but not tested with Stripe CLI for all event types (payment failure, dispute, refund)
- [ ] **Inventory management:** Stock deduction implemented but no handling for payment failure (stock not returned to available pool)
- [ ] **Mobile POS:** Offline mode saves transactions locally but no conflict resolution when multiple devices sold same item
- [ ] **Order fulfillment:** Orders marked as "fulfilled" but no inventory audit trail (can't trace who sold what when)
- [ ] **Webhook processing:** Events stored in database but no monitoring dashboard for failed processing attempts
- [ ] **Refunds:** Refund API implemented but inventory not returned to stock on refund
- [ ] **Mobile sync:** Sync works for inventory but not for product catalog updates (new items don't appear on POS)
- [ ] **Transaction rollback:** Payment fails but reservation not released, cart not restored to available pool
- [ ] **Receipt generation:** Digital receipts work online but no offline receipt printing for mobile POS
- [ ] **Checkout validation:** Server validates stock but not location-based taxes or shipping restrictions
- [ ] **Payment idempotency:** Idempotency key used but not checked before Stripe API call (duplicate charges possible)
- [ ] **Error recovery:** Transaction errors logged but no automated retry or manual review queue

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Oversold inventory (negative stock) | MEDIUM | 1. Identify affected orders, 2. Contact customers with options (wait/refund), 3. Implement reservation system before relaunch, 4. Manual inventory reconciliation |
| Missed webhook (payment succeeded, order not created) | MEDIUM | 1. Poll Stripe API for unprocessed payments, 2. Reconcile against order database, 3. Create orders for orphaned payments, 4. Implement webhook monitoring with alerts |
| Mobile offline queue lost | HIGH | 1. Check device logs for transaction records, 2. Review staff memory for approximate transaction details, 3. Manual transaction recreation, 4. Write off unrecoverable sales, 5. Implement persistent queue |
| Payment replay attack | HIGH | 1. Identify duplicate charges in Stripe, 2. Issue refunds for duplicates, 3. Notify affected customers, 4. Implement idempotency check ASAP, 5. Security audit of webhook handling |
| Inventory sync conflict | LOW | 1. Manual reconciliation: physical count vs system count, 2. Adjust inventory with audit note, 3. Review conflict resolution logic, 4. Implement better conflict detection |
| Transaction timeout during peak | LOW | 1. Customer retry usually works, 2. If customer lost, send recovery email with cart link, 3. Optimize transaction scope, 4. Load test before next peak |
| Database replica lag causing stale inventory | MEDIUM | 1. Force read from primary for inventory queries, 2. Review read concern configuration, 3. Add monitoring for replication lag, 4. Scale replica set if needed |
| Fraud false positive blocking legitimate sale | LOW | 1. Manual review and approval, 2. Send customer recovery link with pre-approved transaction, 3. Tune fraud rules, 4. Implement allow-list |
| Webhook ordering issue causing state error | MEDIUM | 1. Identify stuck orders, 2. Fetch current state from Stripe API, 3. Manually correct order status, 4. Reprocess affected webhooks in correct order, 5. Implement event reordering |
| Mobile device lost with unsynchronized sales | HIGH | 1. If transactions printed, manually enter from receipts, 2. Review staff memory for transaction details, 3. Write off unrecoverable data, 4. Implement cloud backup of offline queue |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Race conditions on inventory | Phase 1: Data Model & Core Logic | Load test with 50+ concurrent checkouts, verify no negative inventory |
| Webhook failure handling | Phase 2: Payment Integration | Simulate webhook failures with Stripe CLI, verify orders still created |
| Mobile offline sync conflicts | Phase 3: Mobile POS Offline Mode | Test scenario: same item sold online and offline simultaneously, verify conflict detected |
| Webhook replay attacks | Phase 2: Payment Integration | Test: replay same webhook 10 times, verify only one order created |
| Inventory reservations without expiry | Phase 1: Data Model & Core Logic | Create cart, abandon, wait 15 min, verify inventory released automatically |
| Payment webhook ordering | Phase 2: Payment Integration | Test: process events out of order, verify system handles gracefully |
| Multi-channel sync lag | Phase 3: Multi-Channel Sync | Sell item on mobile, verify online store updates within 5 seconds |
| MongoDB transaction timeout | Phase 1 + Load Testing Phase | Load test: 100 concurrent transactions, verify <1% failure rate |
| Fraud detection false positives | Phase 2 + Post-Launch Tuning | Monitor decline rate first 2 weeks, tune if >5% decline rate |
| Mobile offline queue overflow | Phase 3: Mobile POS Offline Mode | Test: queue 500+ transactions offline, verify persistence and sync |

## Sources

**Note:** WebSearch was unavailable during this research. The following pitfalls are based on:
- Established patterns in e-commerce and inventory management systems (training data through January 2025)
- Well-documented payment processing best practices (Stripe, PayPal documentation patterns)
- Distributed systems conflict resolution patterns (CRDT, eventual consistency)
- MongoDB transaction handling and concurrency control (official documentation patterns)
- Common issues in POS systems and offline-first mobile applications

**Confidence level:** HIGH for general patterns, MEDIUM for specific implementation details (should be verified against current Stripe/PayPal/MongoDB documentation during implementation)

**Recommended verification during implementation:**
- Stripe webhook handling best practices: https://stripe.com/docs/webhooks/best-practices
- PayPal webhook verification: https://developer.paypal.com/docs/api-basics/notifications/webhooks/
- MongoDB transactions: https://docs.mongodb.com/manual/core/transactions/
- Offline-first architecture patterns for mobile apps

---
*Pitfalls research for: E-commerce with Multi-Channel Inventory Management*
*Researched: 2026-02-13*
*Context: Band merch platform with online store, mobile POS, payment webhooks, offline capability*
