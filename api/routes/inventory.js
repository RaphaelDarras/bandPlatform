const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Sale = require('../models/Sale');
const InventoryAdjustment = require('../models/InventoryAdjustment');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/inventory/deduct:
 *   post:
 *     summary: Deduct stock (final sale)
 *     description: Permanently deduct stock for a completed sale using optimistic locking. Creates audit trail (Order for online, Sale for POS).
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryDeductRequest'
 *     responses:
 *       200:
 *         description: Stock deducted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stockBefore:
 *                   type: number
 *                 stockAfter:
 *                   type: number
 *                 auditId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product or variant not found
 *       409:
 *         description: Insufficient stock or version conflict
 *       500:
 *         description: Internal server error
 */
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
        variants: { $elemMatch: { sku: variantSku, version: variant.version } }
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
        variants: { $elemMatch: { sku: variantSku, version: variant.version } }
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
        variants: { $elemMatch: { sku: variantSku, version: currentVersion } }
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

/**
 * @swagger
 * /api/inventory/restock:
 *   post:
 *     summary: Restock inventory (increase stock)
 *     description: Increase stock for a product variant using optimistic locking. Creates InventoryAdjustment audit record.
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantSku, quantity]
 *             properties:
 *               productId:
 *                 type: string
 *               variantSku:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock increased successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stockBefore:
 *                   type: number
 *                 stockAfter:
 *                   type: number
 *                 version:
 *                   type: number
 *                 adjustmentId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product or variant not found
 *       409:
 *         description: Version conflict — retry with current data
 *       500:
 *         description: Internal server error
 */
router.post('/restock', async (req, res) => {
  try {
    const { productId, variantSku, quantity, reason } = req.body;

    // Validate required fields
    if (!productId || !variantSku || !quantity) {
      return res.status(400).json({
        error: 'productId, variantSku, and quantity are required'
      });
    }

    // Validate quantity is a non-zero integer (negative = removal)
    if (!Number.isInteger(quantity) || quantity === 0) {
      return res.status(400).json({
        error: 'quantity must be a non-zero integer'
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

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, 'variants.sku': variantSku },
      { $inc: { 'variants.$.stock': quantity } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product or variant not found' });
    }

    // Capture stockAfter from updated variant
    const updatedVariant = updatedProduct.variants.find(v => v.sku === variantSku);
    const stockAfter = updatedVariant.stock;

    // Create InventoryAdjustment audit record
    const auditRecord = await InventoryAdjustment.create({
      productId,
      variantSku,
      type: quantity > 0 ? 'restock' : 'removal',
      quantity,
      stockBefore,
      stockAfter,
      reason,
      createdBy: req.user.userId
    });

    res.status(200).json({
      success: true,
      stockBefore,
      stockAfter,
      adjustmentId: auditRecord._id
    });
  } catch (error) {
    console.error('Restock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/inventory/stock:
 *   get:
 *     summary: Get stock summary across all active products
 *     description: Returns a read-only stock summary with grand total, per-product totals, and per-variant breakdown. Only active products are included.
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Stock summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 grandTotal:
 *                   type: number
 *                   description: Total stock units across all active products and variants
 *                 productCount:
 *                   type: number
 *                   description: Number of active products included
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       productTotal:
 *                         type: number
 *                         description: Sum of stock across all variants for this product
 *                       variants:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             sku:
 *                               type: string
 *                             size:
 *                               type: string
 *                             color:
 *                               type: string
 *                             stock:
 *                               type: number
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       500:
 *         description: Internal server error
 */
router.get('/stock', async (req, res) => {
  try {
    const results = await Product.find({ active: true })
      .select('name category variants.sku variants.size variants.color variants.stock')
      .lean();

    const products = results.map(product => {
      const variants = product.variants.map(v => ({
        sku: v.sku,
        size: v.size || null,
        color: v.color || null,
        stock: v.stock
      }));
      const productTotal = variants.reduce((sum, v) => sum + v.stock, 0);
      return {
        productId: product._id,
        name: product.name,
        category: product.category || null,
        productTotal,
        variants
      };
    });

    const grandTotal = products.reduce((sum, p) => sum + p.productTotal, 0);

    res.status(200).json({ grandTotal, productCount: products.length, products });
  } catch (error) {
    console.error('Stock summary error:', error);
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

    const itemMatchConditions = { 'items.productId': productId };
    const adjustmentMatchConditions = { productId: new mongoose.Types.ObjectId(productId) };

    if (startDate || endDate) {
      const dateRange = {};
      if (startDate) dateRange.$gte = new Date(startDate);
      if (endDate) dateRange.$lte = new Date(endDate);
      itemMatchConditions.createdAt = dateRange;
      adjustmentMatchConditions.createdAt = dateRange;
    }

    // Aggregate from Order documents
    const orderAudits = await Order.aggregate([
      { $unwind: '$items' },
      { $match: itemMatchConditions },
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
      { $match: itemMatchConditions },
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

    // Aggregate from InventoryAdjustment documents (top-level productId — no $unwind needed)
    const restockAudits = await InventoryAdjustment.aggregate([
      { $match: adjustmentMatchConditions },
      {
        $project: {
          timestamp: '$createdAt',
          source: '$type',
          quantity: '$quantity',
          stockBefore: '$stockBefore',
          stockAfter: '$stockAfter',
          adjustmentId: '$_id',
          variantSku: '$variantSku'
        }
      }
    ]);

    // Combine and sort by timestamp
    const auditLog = [...orderAudits, ...saleAudits, ...restockAudits].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    res.status(200).json(auditLog);
  } catch (error) {
    console.error('Audit query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
