# Architecture Research

**Domain:** E-commerce with Mobile POS and Unified Inventory
**Researched:** 2026-02-13
**Confidence:** HIGH (based on established patterns for omnichannel retail systems)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Web Client  │  │ Mobile POS   │  │   Payment    │          │
│  │   (React)    │  │(React Native)│  │   Providers  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └─────────┬────────┴──────────────────┘                  │
│                   │ (HTTPS REST)                                 │
├───────────────────┴──────────────────────────────────────────────┤
│                        API LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              REST API (Node.js/Express)                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │  Routes  │ │  Auth    │ │ Business │ │ Webhook  │   │    │
│  │  │          │ │Middleware│ │  Logic   │ │ Handlers │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                      BUSINESS LOGIC LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Inventory  │  │    Order     │  │   Payment    │          │
│  │    Service   │  │   Service    │  │   Service    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                     │
├────────────────────────────┴─────────────────────────────────────┤
│                        DATA LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Products │  │  Orders  │  │ Concerts │  │  Sales   │        │
│  │Collection│  │Collection│  │Collection│  │Collection│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐                                                    │
│  │Inventory │                  MongoDB                           │
│  │Collection│                                                    │
│  └──────────┘                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Web Client | Customer-facing e-commerce storefront | React SPA with product browsing, cart, checkout |
| Mobile POS | On-site sales at concerts/events | React Native app for band members to sell merch |
| REST API | Central business logic orchestration | Express.js with route handlers, middleware, services |
| Inventory Service | Real-time stock management and synchronization | Service layer with atomic operations, stock reservation |
| Order Service | Order lifecycle management across channels | Handles order creation, fulfillment, status tracking |
| Payment Service | Payment processing and webhook handling | Integrates with Stripe/PayPal, processes payment events |
| Payment Providers | External payment gateways | Stripe/PayPal webhooks for async payment confirmation |
| MongoDB Collections | Persistent data storage | Document-based storage for products, orders, inventory |

## Recommended Project Structure

```
bandPlatform/
├── backend/                    # REST API server
│   ├── src/
│   │   ├── config/            # Configuration (DB, payment keys, env)
│   │   ├── middleware/        # Express middleware (auth, validation, error handling)
│   │   ├── models/            # Mongoose schemas (Product, Order, Concert, Sale, Inventory)
│   │   ├── routes/            # API route definitions
│   │   │   ├── products.js    # Product CRUD
│   │   │   ├── orders.js      # Order management
│   │   │   ├── concerts.js    # Concert/event management
│   │   │   ├── sales.js       # POS sales endpoints
│   │   │   └── webhooks.js    # Payment webhook handlers
│   │   ├── services/          # Business logic layer
│   │   │   ├── inventoryService.js   # Stock management with locking
│   │   │   ├── orderService.js       # Order processing
│   │   │   ├── paymentService.js     # Payment integration
│   │   │   └── syncService.js        # Cross-channel sync
│   │   ├── controllers/       # Request handlers
│   │   ├── utils/             # Helpers (logger, validators, formatters)
│   │   └── server.js          # Express app entry point
│   └── package.json
├── web-frontend/              # E-commerce storefront
│   ├── src/
│   │   ├── components/        # React components (ProductCard, Cart, Checkout)
│   │   ├── pages/             # Page components (Home, Product, Cart, Checkout)
│   │   ├── hooks/             # Custom React hooks (useCart, useProducts)
│   │   ├── services/          # API client (axios wrapper)
│   │   ├── context/           # React Context (CartContext, AuthContext)
│   │   ├── utils/             # Frontend utilities
│   │   └── App.jsx            # Main app component
│   └── package.json
├── mobile-pos/                # Mobile POS app
│   ├── src/
│   │   ├── components/        # React Native components (ProductSelector, SaleCart)
│   │   ├── screens/           # Screen components (Dashboard, SaleScreen, Inventory)
│   │   ├── navigation/        # React Navigation setup
│   │   ├── services/          # API client (fetch wrapper with offline queue)
│   │   ├── hooks/             # Custom hooks (useOfflineQueue, useInventorySync)
│   │   ├── context/           # Context providers (SaleContext, SyncContext)
│   │   └── App.jsx            # Root component
│   └── package.json
└── package.json               # Root monorepo (optional)
```

### Structure Rationale

- **backend/services/:** Business logic isolated from route handlers enables reusability across different endpoints (e.g., inventory checks used by both web orders and POS sales)
- **backend/models/:** Mongoose schemas centralize data validation and provide consistent interfaces to MongoDB collections
- **web-frontend/context/:** React Context manages global state (cart, auth) without prop drilling, suitable for medium complexity
- **mobile-pos/services/:** Offline-capable API client with queue for unreliable network conditions at concert venues
- **Separate route files:** Each domain (products, orders, sales) has dedicated routes for maintainability and clear API organization

## Architectural Patterns

### Pattern 1: Centralized Inventory Management with Optimistic Locking

**What:** Single source of truth for inventory with atomic stock operations to prevent overselling across channels

**When to use:** Multi-channel retail (web + mobile POS) sharing same inventory pool

**Trade-offs:**
- Pros: Prevents overselling, consistent stock levels across channels
- Cons: Requires careful transaction handling, potential performance bottleneck under high concurrency

**Example:**
```javascript
// inventoryService.js
async function reserveStock(productId, quantity, channel) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Atomic decrement with validation
    const inventory = await Inventory.findOneAndUpdate(
      {
        productId,
        availableQuantity: { $gte: quantity } // Only succeed if enough stock
      },
      {
        $inc: { availableQuantity: -quantity },
        $push: {
          reservations: {
            quantity,
            channel, // 'web' or 'pos'
            timestamp: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 min expiry
          }
        }
      },
      { session, new: true }
    );

    if (!inventory) {
      throw new Error('Insufficient stock');
    }

    await session.commitTransaction();
    return inventory;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Pattern 2: Event-Driven Payment Webhook Handling

**What:** Asynchronous payment confirmation via webhooks rather than synchronous polling

**When to use:** Integration with payment providers (Stripe, PayPal) for reliable payment state management

**Trade-offs:**
- Pros: Scalable, doesn't block API responses, handles all payment events reliably
- Cons: Requires webhook signature verification, needs idempotency handling for duplicate events

**Example:**
```javascript
// routes/webhooks.js
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: check if event already processed
  const existingEvent = await ProcessedWebhook.findOne({ eventId: event.id });
  if (existingEvent) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Handle event types
  switch (event.type) {
    case 'payment_intent.succeeded':
      await paymentService.confirmPayment(event.data.object);
      await orderService.markAsPaid(event.data.object.metadata.orderId);
      break;
    case 'payment_intent.payment_failed':
      await orderService.markAsFailed(event.data.object.metadata.orderId);
      await inventoryService.releaseReservation(event.data.object.metadata.orderId);
      break;
  }

  // Store event as processed
  await ProcessedWebhook.create({ eventId: event.id, type: event.type });

  res.status(200).json({ received: true });
});
```

### Pattern 3: Offline-First Mobile POS with Sync Queue

**What:** Mobile app queues transactions locally when offline, syncs when connectivity restored

**When to use:** Mobile POS used in environments with unreliable internet (concert venues, outdoor events)

**Trade-offs:**
- Pros: Enables sales during network outages, better UX for staff
- Cons: Complexity in conflict resolution, need local storage management

**Example:**
```javascript
// mobile-pos/services/offlineQueue.js
class OfflineQueue {
  async addSale(saleData) {
    const queueItem = {
      id: generateLocalId(),
      type: 'SALE',
      data: saleData,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    };

    await AsyncStorage.setItem(
      `queue_${queueItem.id}`,
      JSON.stringify(queueItem)
    );

    // Attempt immediate sync if online
    if (await isOnline()) {
      this.processQueue();
    }

    return queueItem.id;
  }

  async processQueue() {
    const queueKeys = await AsyncStorage.getAllKeys();
    const pendingItems = queueKeys
      .filter(key => key.startsWith('queue_'))
      .map(async key => JSON.parse(await AsyncStorage.getItem(key)))
      .filter(item => item.status === 'pending');

    for (const item of pendingItems) {
      try {
        // Send to backend API
        await api.post('/sales', item.data);

        // Mark as synced and remove from queue
        await AsyncStorage.removeItem(`queue_${item.id}`);
      } catch (error) {
        // Increment retry count, keep in queue
        item.retries++;
        if (item.retries > 5) {
          item.status = 'failed'; // Manual intervention needed
        }
        await AsyncStorage.setItem(`queue_${item.id}`, JSON.stringify(item));
      }
    }
  }
}
```

## Data Flow

### Request Flow: Web Order Purchase

```
Customer (Web) → Add to Cart
    ↓
React Cart Context updates local state
    ↓
Customer clicks Checkout → POST /api/orders
    ↓
API Route → orderService.createOrder()
    ↓
orderService → inventoryService.reserveStock() [ATOMIC]
    ↓ (if stock available)
orderService → paymentService.createPaymentIntent()
    ↓
Response with payment client secret → Web Client
    ↓
Stripe Elements collects payment → Stripe processes
    ↓
Stripe sends webhook → POST /api/webhooks/stripe
    ↓
Webhook handler → orderService.confirmOrder()
    ↓
orderService → inventoryService.finalizeReservation()
    ↓
Order status: 'paid', Inventory: decremented permanently
```

### Request Flow: Mobile POS Sale

```
Band Member (POS) → Scans/Selects Product
    ↓
React Native SaleScreen → Add to sale cart (local state)
    ↓
Complete Sale → POST /api/sales (or queue if offline)
    ↓
API Route → salesService.createSale()
    ↓
salesService → inventoryService.reserveStock() [ATOMIC, same as web]
    ↓
salesService → Creates Sale record with 'completed' status
    ↓
Inventory updated immediately (cash/card on-site)
    ↓
Sale synced to Orders collection for unified reporting
    ↓
Response → POS shows confirmation/receipt
```

### State Management: Inventory Synchronization

```
Inventory Collection (Source of Truth)
    ↓ (read operations)
Web Frontend ←→ GET /api/products (includes current stock)
    ↓
Mobile POS ←→ GET /api/inventory/sync (periodic background sync)
    ↓ (write operations)
Order/Sale Creation → inventoryService.reserveStock()
    ↓ [MongoDB Transaction]
Inventory.availableQuantity updated atomically
    ↓
Both web and POS see updated stock on next fetch
```

### Key Data Flows

1. **Stock Reservation Flow:** Both web orders and POS sales use the same `inventoryService.reserveStock()` with MongoDB transactions, ensuring atomicity. Reservations expire after 15 minutes if order not completed.

2. **Payment Confirmation Flow:** Web orders create pending status, wait for webhook confirmation. POS sales are immediate (cash/on-site card) so marked 'completed' instantly.

3. **Cross-Channel Visibility:** Inventory updates propagate immediately to both channels. Web frontend fetches fresh stock on product page load. Mobile POS syncs inventory every 5 minutes in background.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Monolithic API + MongoDB on single server. React/React Native directly call API. Simple and sufficient. |
| 1k-50k users | Add Redis caching for product catalog. Implement read replicas for MongoDB. CDN for static assets. Load balancer with 2-3 API instances. |
| 50k-500k users | Separate inventory service into dedicated microservice with its own database. Implement message queue (RabbitMQ/SQS) for order processing. Scale MongoDB with sharding. Implement rate limiting per client. |

### Scaling Priorities

1. **First bottleneck:** Inventory service database locks under concurrent web orders + POS sales
   - **Fix:** Implement Redis-based distributed locking instead of MongoDB transactions. Cache product availability with short TTL (30s).

2. **Second bottleneck:** Webhook processing delays during high-volume sales (e.g., album release)
   - **Fix:** Move webhook handlers to background job queue (Bull/BullMQ). API immediately returns 200, processes webhook asynchronously.

3. **Third bottleneck:** Mobile app sync overwhelming API during peak times (multiple POS devices at large concert)
   - **Fix:** Implement batch sync endpoints. Stagger sync intervals across devices. Use WebSockets for real-time inventory updates instead of polling.

## Anti-Patterns

### Anti-Pattern 1: Checking Stock Before Reservation (Race Condition)

**What people do:** Query inventory availability, then create order, then decrement stock in separate operations
```javascript
// WRONG - Race condition
const product = await Inventory.findOne({ productId });
if (product.availableQuantity >= quantity) {
  await Order.create({ productId, quantity }); // Another request could happen here!
  await Inventory.updateOne({ productId }, { $inc: { availableQuantity: -quantity }});
}
```

**Why it's wrong:** Between check and update, another request can decrement stock, leading to overselling

**Do this instead:** Atomic update with condition in single operation (Pattern 1 above)
```javascript
// CORRECT - Atomic operation
const inventory = await Inventory.findOneAndUpdate(
  { productId, availableQuantity: { $gte: quantity } },
  { $inc: { availableQuantity: -quantity }},
  { new: true }
);
if (!inventory) throw new Error('Insufficient stock');
```

### Anti-Pattern 2: Synchronous Payment Processing in API Response

**What people do:** Call payment provider API synchronously and wait for confirmation before responding
```javascript
// WRONG - Blocks request
router.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  const payment = await stripe.charges.create({ ... }); // Waits up to 30s
  if (payment.status === 'succeeded') {
    order.status = 'paid';
  }
  res.json(order); // User waits entire time
});
```

**Why it's wrong:** Payment providers can take 5-30 seconds, causing timeouts and poor UX. Payment can also succeed after timeout, causing inconsistent state.

**Do this instead:** Create payment intent, return immediately, handle confirmation via webhook (Pattern 2 above)
```javascript
// CORRECT - Async with webhooks
router.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  const paymentIntent = await stripe.paymentIntents.create({ ... }); // Returns immediately
  res.json({ order, clientSecret: paymentIntent.client_secret }); // User continues
});
// Webhook handler updates order when payment confirms
```

### Anti-Pattern 3: Shared Mutable State Between Web and POS Without Locking

**What people do:** Each channel maintains local inventory count, syncs periodically
```javascript
// WRONG - Eventual inconsistency leads to overselling
// Web app
let localStock = 10;
if (localStock > 0) {
  localStock--;
  await api.post('/orders'); // Stock might be gone already
}

// POS app (happening simultaneously)
let localStock = 10; // Same starting point
if (localStock > 0) {
  localStock--;
  await api.post('/sales'); // Both sell the last item!
}
```

**Why it's wrong:** Local caches go stale, leading to overselling when both channels active simultaneously

**Do this instead:** Single source of truth with pessimistic locking (centralized inventory service)
```javascript
// CORRECT - Centralized with atomic operations
// Both web and POS call the same endpoint
const reserved = await inventoryService.reserveStock(productId, quantity, channel);
if (!reserved) throw new Error('Out of stock'); // Fails fast if insufficient
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe | Webhook-driven payment confirmation | Verify webhook signatures. Store payment intent IDs in orders. Handle idempotency. |
| PayPal | OAuth + webhook callbacks | Require sandbox testing. PayPal IPN can have delays (up to 30 min). |
| Email Service (SendGrid/Mailgun) | Background job for order confirmations | Don't block API responses. Queue emails, retry on failure. |
| SMS Service (Twilio) | Optional for order status updates | Rate limit to avoid spam. Store opt-in preferences. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web Frontend ↔ API | REST over HTTPS (JSON) | Use JWT tokens for authentication. Implement CORS properly. |
| Mobile POS ↔ API | REST over HTTPS (JSON) | Offline queue for unreliable networks. Different auth scope (staff vs customer). |
| API ↔ MongoDB | Mongoose ODM | Use connection pooling. Implement retry logic for transient failures. |
| API ↔ Payment Providers | HTTPS REST + Webhooks | Always verify webhook signatures. Log all payment events for audit trail. |
| Inventory Service ↔ Other Services | Direct function calls (monolith) | Keep interface consistent if extracting to microservice later. |

## Build Order and Dependencies

### Phase 1: Foundation (Backend Core + Database)
**Build first because:** All other components depend on API and data layer

**Components:**
1. MongoDB schema definitions (Product, Order, Concert, Sale, Inventory models)
2. Basic Express server setup with middleware
3. Authentication middleware
4. Core inventory service with atomic operations

**Dependency:** None (greenfield start)

### Phase 2: Product and Inventory Management
**Build second because:** Need data to populate before building sales flows

**Components:**
1. Product CRUD endpoints
2. Inventory management endpoints
3. Concert/event management endpoints
4. Admin routes for data management

**Dependency:** Phase 1 (needs models and API foundation)

### Phase 3: Web Frontend E-commerce
**Build third because:** Primary revenue channel, easier to test than mobile

**Components:**
1. React storefront with product catalog
2. Cart management (Context API)
3. Checkout flow UI

**Dependency:** Phase 2 (needs products API to display inventory)

### Phase 4: Payment Integration
**Build fourth because:** Needs complete order flow to test

**Components:**
1. Stripe/PayPal payment intent creation
2. Webhook handlers for payment confirmation
3. Order status management

**Dependency:** Phase 3 (needs order creation flow in place)

### Phase 5: Mobile POS Application
**Build fifth because:** Most complex due to offline requirements

**Components:**
1. React Native POS interface
2. Offline queue system
3. Background sync service
4. Staff authentication

**Dependency:** Phase 2 + Phase 4 (needs sales endpoints and inventory service fully functional)

### Phase 6: Cross-Channel Testing and Optimization
**Build last because:** Requires all components operational

**Components:**
1. Load testing inventory service under concurrent access
2. Conflict resolution testing (simultaneous web/POS sales)
3. Webhook reliability testing
4. Performance optimization (caching, indexes)

**Dependency:** Phase 5 (needs complete system)

### Critical Path
```
Phase 1 (Backend) → Phase 2 (Inventory APIs) → Phase 4 (Payments)
                                              ↓
                                          Phase 3 (Web) ← testable early
                                              ↓
                                          Phase 5 (Mobile POS)
                                              ↓
                                          Phase 6 (Integration)
```

**Note:** Web frontend (Phase 3) can start in parallel with Phase 2 using mock data, but should integrate with real APIs before payment implementation.

## Sources

**Confidence note:** This architecture is based on established patterns for omnichannel retail systems combining e-commerce and mobile POS. WebSearch was unavailable, so recommendations draw from widely-documented best practices for:

- REST API design patterns for inventory management (atomic operations, optimistic locking)
- Payment provider integration patterns (Stripe/PayPal webhook handling)
- Mobile offline-first architecture (sync queues, conflict resolution)
- MongoDB transaction handling for multi-document operations

These patterns are stable and well-established (not subject to rapid year-over-year change), giving HIGH confidence despite lack of 2026-specific sources.

**References:**
- MongoDB transactions: Official MongoDB documentation on multi-document ACID transactions
- Stripe webhooks: Stripe API documentation on webhook event handling and signature verification
- Offline-first mobile: Established pattern in React Native community for POS/field applications
- Inventory management: Standard e-commerce architecture patterns for preventing overselling

---
*Architecture research for: Band merch platform (e-commerce + mobile POS)*
*Researched: 2026-02-13*
