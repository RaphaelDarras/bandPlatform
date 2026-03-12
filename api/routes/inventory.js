const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Sale = require('../models/Sale');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// POST /deduct - Primary stock deduction endpoint (online shop and POS)
router.post('/deduct', async (req, res) => {
  try {
    const { productId, variantSku, quantity, source, metadata } = req.body;

    // Validate required fields
    if (!productId || !variantSku || !quantity || !source || !metadata) {
      return res.status(400).json({
        error: 'productId, variantSku, quantity, source, and metadata are required'
      });
    }

    if (!['online', 'pos'].includes(source)) {
      return res.status(400).json({
        error: 'source must be either "online" or "pos"'
      });
    }

    // Find product and specific variant
    const product = await Product.findOne({
      _id: productId,
      'variants.sku': variantSku
    });

    if (!product) {
      return res.status(404).json({ error: 'Product or variant not found' });
    }

    // Extract matching variant
    const variant = product.variants.find(v => v.sku === variantSku);
    const stockBefore = variant.stock;

    // Check sufficient stock
    if (stockBefore < quantity) {
      return res.status(409).json({
        error: 'Insufficient stock',
        available: stockBefore
      });
    }

    // Optimistic locking update
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        'variants.sku': variantSku,
        'variants.$.version': variant.version
      },
      {
        $inc: {
          'variants.$.stock': -quantity,
          'variants.$.version': 1
        }
      },
      { new: true }
    );

    // Check for version conflict
    if (!updatedProduct) {
      return res.status(409).json({
        error: 'Stock conflict - version mismatch. Please retry with updated stock data.'
      });
    }

    // Capture stockAfter from updated variant
    const updatedVariant = updatedProduct.variants.find(v => v.sku === variantSku);
    const stockAfter = updatedVariant.stock;

    // EXPLICIT audit trail creation
    let auditRecord;

    if (source === 'online') {
      auditRecord = await Order.create({
        orderNumber: metadata.orderId || `ORD-${Date.now()}`,
        customerEmail: metadata.customerEmail,
        items: [{
          productId,
          variantSku,
          quantity,
          priceAtPurchase: metadata.priceAtPurchase,
          stockBefore,
          stockAfter
        }],
        totalAmount: metadata.totalAmount,
        status: 'pending',
        source: 'online'
      });
    } else if (source === 'pos') {
      auditRecord = await Sale.create({
        concertId: metadata.concertId,
        items: [{
          productId,
          variantSku,
          quantity,
          priceAtSale: metadata.priceAtPurchase,
          stockBefore,
          stockAfter
        }],
        totalAmount: metadata.totalAmount,
        paymentMethod: metadata.paymentMethod || 'cash',
        source: 'pos',
        createdBy: req.user.userId
      });
    }

    res.status(200).json({
      success: true,
      stockAfter,
      version: updatedVariant.version,
      auditId: auditRecord._id
    });
  } catch (error) {
    console.error('Deduct stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /reserve - Reserve stock for online checkout (10-minute timeout)
router.post('/reserve', async (req, res) => {
  try {
    const { productId, variantSku, quantity, reservationId } = req.body;

    // Validate required fields
    if (!productId || !variantSku || !quantity || !reservationId) {
      return res.status(400).json({
        error: 'productId, variantSku, quantity, and reservationId are required'
      });
    }

    // Find product and variant
    const product = await Product.findOne({
      _id: productId,
      'variants.sku': variantSku
    });

    if (!product) {
      return res.status(404).json({ error: 'Product or variant not found' });
    }

    // Extract matching variant
    const variant = product.variants.find(v => v.sku === variantSku);

    // Check sufficient stock
    if (variant.stock < quantity) {
      return res.status(409).json({
        error: 'Insufficient stock',
        available: variant.stock
      });
    }

    // Optimistic locking update
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        'variants.sku': variantSku,
        'variants.$.version': variant.version
      },
      {
        $inc: {
          'variants.$.stock': -quantity,
          'variants.$.version': 1
        }
      },
      { new: true }
    );

    // Check for version conflict
    if (!updatedProduct) {
      return res.status(409).json({
        error: 'Stock conflict - version mismatch. Please retry with updated stock data.'
      });
    }

    const updatedVariant = updatedProduct.variants.find(v => v.sku === variantSku);

    // Calculate expiration (10 minutes)
    const expiresAt = Date.now() + 600000;

    res.status(200).json({
      reserved: true,
      expiresAt,
      version: updatedVariant.version
    });
  } catch (error) {
    console.error('Reserve stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /release - Release reserved stock if payment fails or times out
router.post('/release', async (req, res) => {
  try {
    const { productId, variantSku, quantity, reservationId, currentVersion } = req.body;

    // Validate required fields
    if (!productId || !variantSku || !quantity || currentVersion === undefined) {
      return res.status(400).json({
        error: 'productId, variantSku, quantity, and currentVersion are required'
      });
    }

    // Optimistic locking update to increment stock back
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        'variants.sku': variantSku,
        'variants.$.version': currentVersion
      },
      {
        $inc: {
          'variants.$.stock': quantity,
          'variants.$.version': 1
        }
      },
      { new: true }
    );

    // Check for version conflict
    if (!updatedProduct) {
      return res.status(409).json({
        error: 'Stock conflict - version mismatch. Please retry with updated stock data.'
      });
    }

    const updatedVariant = updatedProduct.variants.find(v => v.sku === variantSku);

    res.status(200).json({
      released: true,
      stockAfter: updatedVariant.stock,
      version: updatedVariant.version
    });
  } catch (error) {
    console.error('Release stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /audit - Query inventory audit trail from Order/Sale documents
router.get('/audit', async (req, res) => {
  try {
    const { productId, startDate, endDate } = req.query;

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const matchConditions = { 'items.productId': productId };

    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
      if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
    }

    // Aggregate from Order documents
    const orderAudits = await Order.aggregate([
      { $unwind: '$items' },
      { $match: matchConditions },
      {
        $project: {
          timestamp: '$createdAt',
          source: { $literal: 'online' },
          quantity: '$items.quantity',
          stockBefore: '$items.stockBefore',
          stockAfter: '$items.stockAfter',
          orderId: '$_id',
          variantSku: '$items.variantSku'
        }
      }
    ]);

    // Aggregate from Sale documents
    const saleAudits = await Sale.aggregate([
      { $unwind: '$items' },
      { $match: matchConditions },
      {
        $project: {
          timestamp: '$createdAt',
          source: { $literal: 'pos' },
          quantity: '$items.quantity',
          stockBefore: '$items.stockBefore',
          stockAfter: '$items.stockAfter',
          saleId: '$_id',
          variantSku: '$items.variantSku'
        }
      }
    ]);

    // Combine and sort by timestamp
    const auditLog = [...orderAudits, ...saleAudits].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    res.status(200).json(auditLog);
  } catch (error) {
    console.error('Audit query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
