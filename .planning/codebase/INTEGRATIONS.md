# External Integrations

**Analysis Date:** 2026-02-13

## APIs & External Services

**Payment Processing:**
- Stripe - Online payment processing for e-shop
  - SDK/Client: `stripe` (backend), `@stripe/stripe-js`, `@stripe/react-stripe-js` (frontend)
  - Auth: `STRIPE_SECRET_KEY` (backend), `STRIPE_PUBLISHABLE_KEY` (frontend)
  - Webhooks: Stripe webhook endpoint for payment confirmation
  - Implementation: Payment Intent flow with Stripe Elements

- PayPal - Alternative payment method for e-shop
  - SDK/Client: `@paypal/checkout-server-sdk`
  - Auth: PayPal API credentials (Client ID, Secret)
  - Webhooks: PayPal IPN (Instant Payment Notification) for transaction confirmation
  - Implementation: Server-side payment processing with PayPal buttons frontend

**Streaming/Music Services (Optional):**
- Spotify/Apple Music/YouTube Music - Links for band discography (referenced in roadmap)
  - Integration: Static links on discography page (no SDK required)

## Data Storage

**Databases:**
- MongoDB (NoSQL)
  - Provider: MongoDB Atlas (free tier)
  - Connection: `MONGODB_URI` environment variable
  - Client: Mongoose ODM
  - Collections:
    - Products (merch items with stock tracking)
    - Orders (online e-shop purchases)
    - Concerts (band events with dates/locations)
    - Sales (physical concert merchandise sales)
    - Inventory (stock movement audit logs)

**File Storage:**
- Cloudinary (planned for product images) OR local filesystem
  - Purpose: Product images and band photos
  - Integration: Image optimization and CDN delivery (optional)

**Caching:**
- None specified - direct database queries planned

## Authentication & Identity

**Auth Provider:**
- Custom JWT implementation
  - Implementation: jsonwebtoken library
  - For: Mobile app admin authentication
  - Tokens issued at login endpoint
  - Validated via middleware on protected routes

**Authorization:**
- Role-based access control (planned):
  - Public routes: Products (catalog), Orders (creation)
  - Admin-only routes: Sales, Concerts, Inventory (via JWT)

## Monitoring & Observability

**Error Tracking:**
- Not yet specified - console logging expected initially

**Logs:**
- Server-side: Express middleware logging (planned)
- Client-side: Browser console (development phase)

**Webhooks & Callbacks:**

**Incoming (to API):**
- `POST /webhooks/stripe` - Stripe payment confirmation webhook
  - Trigger: Payment completion, failure, cancellation
  - Action: Update Order payment status, deduct inventory
- `POST /webhooks/paypal` - PayPal IPN notification
  - Trigger: Transaction completion
  - Action: Update Order payment status, deduct inventory

**Outgoing (from API):**
- Email notifications (via Nodemailer, optional):
  - Order confirmation emails to customers
  - Admin notification on successful payments
  - Concert summary emails (optional)

## CI/CD & Deployment

**Hosting:**
- Backend API: Render.com or Railway.app (free tier)
- Frontend Web: Vercel or Netlify (free tier)
- Mobile: Direct APK distribution to device
- Database: MongoDB Atlas (free 512MB tier)

**CI Pipeline:**
- Not configured - planned for post-MVP phase
- Git-based deployment likely via Vercel/Netlify auto-deploy

**Domain & DNS:**
- Custom domain recommended (~10-15€/year)
- SSL/HTTPS: Automatic via Render/Vercel/Netlify

## Environment Configuration

**Required env vars (Backend):**
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
CORS_ORIGIN=https://frontend-url.com
NODE_ENV=production
API_PORT=5000
```

**Required env vars (Frontend):**
```
VITE_API_BASE_URL=https://api.example.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
VITE_PAYPAL_CLIENT_ID=...
```

**Required env vars (Mobile):**
```
API_BASE_URL=https://api.example.com
JWT_STORAGE_KEY=admin_token
```

**Secrets location:**
- `.env` files (local development) - NOT committed to git
- Platform-specific secret management:
  - Render/Railway: Environment variables dashboard
  - Vercel/Netlify: Environment variables dashboard
  - MongoDB Atlas: API keys in project settings

## Testing Services

**Stripe Testing:**
- Stripe Dashboard (mode toggle between test and live)
- Test card: 4242 4242 4242 4242
- Webhook testing: Stripe CLI or webhook endpoint testing tools

**PayPal Testing:**
- PayPal Sandbox environment (separate from production)
- Sandbox credentials used during development

**Database Testing:**
- MongoDB Atlas free tier used for dev/test

## Email & Notifications

**Email Service (Optional):**
- Nodemailer - For sending order confirmations
  - Service: Gmail, SendGrid, or custom SMTP
  - Configuration: Email credentials in `.env`
  - Triggers: Order creation, payment success

## Third-Party Tools

**Development/Testing:**
- Thunder Client (VSCode) - API endpoint testing
- MongoDB Compass - Database GUI explorer
- Expo CLI - Mobile app building and testing

---

*Integration audit: 2026-02-13*
