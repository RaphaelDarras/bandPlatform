require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/database');
const { swaggerUi, swaggerSpec } = require('./config/swagger');

const app = express();

// 1. Webhook routes FIRST -- raw body required for Stripe/PayPal signature
// verification (AUTH-03). Must be mounted BEFORE express.json() below:
// otherwise Express parses+re-serializes the body, destroying the exact
// bytes the provider's signature was computed over (webhooks.js scopes
// express.raw() per-route internally).
app.use('/api/webhooks', require('./routes/webhooks'));

// 2. THEN the global JSON parser for every other route.
app.use(express.json());
// WR-09 — was origin: '*'. Now that /api/orders collects guest-checkout PII
// (email, name, full shipping address) and drives real PayPal capture calls,
// an unrestricted origin lets any third-party site's client-side JS invoke
// these unauthenticated endpoints directly. Restrict to the single known web
// origin (WEB_BASE_URL, already used app-wide for Stripe/PayPal redirect
// URLs); the `cors` package treats a falsy origin the same as '*', so local
// dev without WEB_BASE_URL set is unaffected. This is a browser-only
// restriction — it does not affect the mobile app's native fetch calls,
// which never enforce/require CORS headers.
app.use(cors({ origin: process.env.WEB_BASE_URL }));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 3. Normal routes (unaffected -- receive parsed JSON bodies)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/concerts', require('./routes/concerts'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/orders', require('./routes/orders'));

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
