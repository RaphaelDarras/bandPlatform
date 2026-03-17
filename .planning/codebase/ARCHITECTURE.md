# Architecture

**Analysis Date:** 2026-02-13

## Pattern Overview

**Overall:** Multi-application platform with distributed responsibility across backend API, web frontend, and mobile admin client.

**Key Characteristics:**
- **Monorepo structure** with separate applications (API, web, mobile) sharing common data models
- **Event-driven stock management** with centralized inventory tracking across online orders and physical concert sales
- **API-first design** where frontend and mobile clients consume consistent REST endpoints
- **Microservice-ready** foundation with clear separation between business logic and presentation

## Layers

**API Backend (REST):**
- Purpose: Central business logic for all operations (products, orders, concerts, sales, inventory management)
- Location: `api/` (planned)
- Contains: Express.js routes, Mongoose schemas, middleware, payment processing logic, authentication
- Depends on: MongoDB (data), Stripe/PayPal (payments), external email service (optional)
- Used by: Web frontend, Mobile app, Webhooks

**Web Frontend (Vitrine + E-shop):**
- Purpose: Public-facing website with marketing content, event listings, and merchandise catalog with checkout
- Location: `web/` (planned)
- Contains: React components, pages, state management, payment UI integration
- Depends on: API backend, Stripe.js, PayPal SDK
- Used by: End users (customers)

**Mobile Admin App (Concert Sales):**
- Purpose: Admin tool for recording physical sales at concerts in real-time
- Location: `mobile/` (planned)
- Contains: React Native screens, local state, API integration, offline fallbacks
- Depends on: API backend, JWT authentication
- Used by: Band members/staff during events

**Database Layer:**
- Purpose: Persistent data storage and relationships
- Location: MongoDB (Atlas or local)
- Contains: 5 collections (Products, Orders, Concerts, Sales, Inventory)
- Depends on: Nothing
- Used by: API backend exclusively

## Data Flow

**Online Order Flow (E-shop):**

1. Customer browses products via web frontend
2. Frontend fetches product list from `GET /api/products`
3. Customer adds items to cart, proceeds to checkout
4. Frontend initiates payment via `POST /api/payments/intent` (Stripe) or PayPal SDK
5. Frontend submits payment to Stripe/PayPal
6. Payment gateway triggers webhook to `POST /api/webhooks/stripe` or PayPal equivalent
7. API verifies payment and creates Order document
8. API creates Inventory logs for each product deduction
9. Frontend receives order confirmation

**Physical Concert Sale Flow (Mobile App):**

1. Admin logs in with JWT authentication via `POST /api/auth/login`
2. Mobile app fetches upcoming concerts via `GET /api/concerts`
3. Admin selects concert
4. App displays products with current stock via `GET /api/products?concert_id={id}`
5. Admin scans or selects items, adds to cart
6. Admin submits sale via `POST /api/sales`
7. API verifies stock availability, deducts inventory
8. API creates Inventory logs for each product deduction
9. App displays confirmation and refreshes remaining stock

**Stock Management (Centralized):**

- Real-time stock calculated from Products collection
- Deductions logged in Inventory collection (append-only audit trail)
- Every Order/Sale creation validates stock and uses MongoDB transactions
- Stock updates are immediate across all clients (no caching)

**State Management:**

- Web frontend: Context API or Zustand for cart/auth state
- Mobile app: React state for local cart, periodic sync with API
- Server: MongoDB as source of truth, no in-memory caching

## Key Abstractions

**Product Model:**
- Purpose: Represents merchandise items (t-shirts, CDs, vinyl, stickers, etc.)
- Examples: `api/models/Product.js`
- Pattern: Mongoose schema with validation, stock tracking, pricing

**Order Model:**
- Purpose: Represents online purchases from e-shop
- Examples: `api/models/Order.js`
- Pattern: Embeds client info and product references, includes payment metadata and state machine (pending/paid/failed)

**Sale Model:**
- Purpose: Represents physical point-of-sale transactions at concerts
- Examples: `api/models/Sale.js`
- Pattern: Links to Concert, includes timestamp and payment method, triggers immediate stock deduction

**Concert Model:**
- Purpose: Represents band performance events
- Examples: `api/models/Concert.js`
- Pattern: Contains date, location, active status; used to scope sales and organize inventory

**Inventory Model:**
- Purpose: Append-only audit log of all stock movements
- Examples: `api/models/Inventory.js`
- Pattern: Immutable records linking to source (Order/Sale), supporting reconciliation and reporting

## Entry Points

**Web Application:**
- Location: `web/src/App.jsx` (planned)
- Triggers: Browser navigation to root URL or Vercel/Netlify deployment
- Responsibilities: Route initialization, authentication check, theme setup, API client configuration

**Mobile Application:**
- Location: `mobile/app.json` and `mobile/App.tsx` (planned)
- Triggers: User taps app icon on Android device
- Responsibilities: Route initialization, JWT token retrieval, offline state check

**API Server:**
- Location: `api/index.js` or `api/server.js` (planned)
- Triggers: Process start on Render/Railway deployment or local `npm start`
- Responsibilities: Express server initialization, database connection, middleware setup, route registration

**Webhook Receivers:**
- Location: `api/routes/webhooks.js` (planned)
- Triggers: External events from Stripe or PayPal (payment events)
- Responsibilities: Verify webhook signature, update Order status, trigger inventory deduction

## Error Handling

**Strategy:** Graceful degradation with explicit status codes and user-friendly messages

**Patterns:**

- **400 Bad Request:** Validation failures (missing fields, invalid format)
- **401 Unauthorized:** Missing or invalid JWT token
- **402 Payment Required:** Insufficient stock or payment processing failure
- **404 Not Found:** Resource doesn't exist
- **409 Conflict:** Stock exhausted during concurrent orders (optimistic locking)
- **500 Internal Server Error:** Unexpected server errors with error ID for support

**Frontend Error Handling:**
- Catch API errors and display user-friendly messages
- Retry logic for transient failures (network timeouts)
- Graceful fallback for offline mode (mobile app)

**Backend Error Handling:**
- Try-catch blocks around payment processing and database operations
- Logging of errors with context for debugging
- MongoDB transactions to prevent partial state on failures

## Cross-Cutting Concerns

**Logging:**
- API: Console logs (expandable to service like Datadog or LogRocket)
- Pattern: Log authentication events, payment processing, inventory changes with timestamps

**Validation:**
- API: Joi or express-validator for request body schemas
- Web: React Hook Form for form validation
- Mobile: React Hook Form or similar
- Pattern: Validate early at API layer, repeat on frontend for UX

**Authentication:**
- Pattern: JWT tokens issued on login, verified by middleware on protected routes
- Web: Session-based with token stored in httpOnly cookie or localStorage
- Mobile: Token stored securely, refreshed before expiration
- Admin-only routes: Check JWT payload for admin role

**Rate Limiting:**
- Pattern: Express rate limiter middleware on public endpoints (payments, orders)
- Prevents abuse and DDoS attacks
- More lenient on authenticated admin endpoints

**CORS Configuration:**
- Pattern: Allow web frontend and mobile app origins
- Restrict to specific methods (GET, POST, PUT, DELETE)

---

*Architecture analysis: 2026-02-13*
