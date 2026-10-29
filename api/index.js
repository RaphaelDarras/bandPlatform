require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/database');
const { swaggerUi, swaggerSpec } = require('./config/swagger');

const app = express();

// Global JSON parser.
app.use(express.json());
// WR-09 -- restrict CORS to the single known web origin (WEB_BASE_URL); the
// `cors` package treats a falsy origin the same as '*', so local dev without
// WEB_BASE_URL set is unaffected. Browser-only restriction; the mobile app's
// native fetch calls never enforce CORS.
app.use(cors({ origin: process.env.WEB_BASE_URL }));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/concerts', require('./routes/concerts'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/votes', require('./routes/votes'));

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
