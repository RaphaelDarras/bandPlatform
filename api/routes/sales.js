const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/sales/batch
 * Submit a batch of offline sales with idempotency key deduplication.
 * Duplicates (matching idempotencyKey) are silently skipped.
 * Stock can go negative — concert sales are never rejected.
 */
router.post('/batch', async (req, res) => {
  try {
    const batch = req.body;

    // Validate non-empty array
    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of sales' });
    }

    let created = 0;
    let skipped = 0;
    const sales = [];

    for (const saleData of batch) {
      const { concertId, items, totalAmount, paymentMethod, idempotencyKey, currency, discount, discountType } = saleData;

      // Check for duplicate idempotencyKey
      if (idempotencyKey) {
        const existing = await Sale.findOne({ idempotencyKey });
        if (existing) {
          skipped++;
          continue;
        }
      }

      // For each item, read stockBefore and atomically deduct stock
      const resolvedItems = [];
      for (const item of items) {
        const { productId, variantSku, quantity, priceAtSale } = item;

        // Read current stock (stockBefore)
        const product = await Product.findOne({ 'variants.sku': variantSku });
        const variant = product
          ? product.variants.find(v => v.sku === variantSku)
          : null;
        const stockBefore = variant ? variant.stock : 0;

        // Atomically deduct stock — concert sales never rejected (stock can go negative)
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId, 'variants.sku': variantSku },
          { $inc: { 'variants.$.stock': -quantity } },
          { new: true }
        );

        const updatedVariant = updatedProduct
          ? updatedProduct.variants.find(v => v.sku === variantSku)
          : null;
        const stockAfter = updatedVariant ? updatedVariant.stock : stockBefore - quantity;

        resolvedItems.push({
          productId,
          variantSku,
          quantity,
          priceAtSale,
          stockBefore,
          stockAfter,
        });
      }

      // Normalise paymentMethod to backend enum
      const PM_MAP = { Cash: 'cash', Card: 'card', 'E-transfer': 'etransfer', PayPal: 'paypal' };
      const normalisedPM = PM_MAP[paymentMethod] ?? (paymentMethod || 'cash').toLowerCase();

      // Build and save sale
      const createPayload = {
        items: resolvedItems,
        totalAmount,
        paymentMethod: normalisedPM,
        currency: currency || 'EUR',
        discount: discount || 0,
        discountType: discountType || 'flat',
        idempotencyKey,
        source: 'pos',
        createdBy: req.user.userId,
      };
      // Only set concertId when it's a non-empty value (ObjectId field — empty string throws)
      if (concertId) createPayload.concertId = concertId;

      const saleDoc = await Sale.create(createPayload);

      sales.push(saleDoc);
      created++;
    }

    return res.status(201).json({ created, skipped, sales });
  } catch (error) {
    console.error('Batch sale error:', error.message, error.errors ?? '');
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

/**
 * PATCH /api/sales/:id
 * Update mutable fields on a sale. Currently supports: concertId.
 */
router.patch('/:id', async (req, res) => {
  try {
    const { concertId } = req.body;
    const update = {};
    if (concertId !== undefined) update.concertId = concertId || null;

    // /:id is the local UUID — look up via idempotencyKey since MongoDB _id is never sent to the app
    const sale = await Sale.findOneAndUpdate(
      { idempotencyKey: `sale_create:${req.params.id}` },
      { $set: update },
      { new: true }
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    return res.status(200).json(sale);
  } catch (error) {
    console.error('Update sale error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sales
 * List all sales sorted by createdAt desc.
 * Optional query param: concertId — filters by concert.
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.concertId) {
      filter.concertId = req.query.concertId;
    }

    const sales = await Sale.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(sales);
  } catch (error) {
    console.error('List sales error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sales/:id/void
 * Void a sale: sets voidedAt and voidedBy, reverses stock.
 */
router.post('/:id/void', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.voidedAt) {
      return res.status(400).json({ error: 'Sale already voided' });
    }

    // Reverse stock for each item
    for (const item of sale.items) {
      await Product.findOneAndUpdate(
        { _id: item.productId, 'variants.sku': item.variantSku },
        { $inc: { 'variants.$.stock': item.quantity } }
      );
    }

    sale.voidedAt = new Date();
    sale.voidedBy = req.user.userId;
    await sale.save();

    return res.status(200).json(sale);
  } catch (error) {
    console.error('Void sale error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sales/:id/unvoid
 * Unvoid a sale: clears voidedAt and voidedBy, re-deducts stock.
 */
router.post('/:id/unvoid', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (!sale.voidedAt) {
      return res.status(400).json({ error: 'Sale is not voided' });
    }

    // Re-deduct stock for each item
    for (const item of sale.items) {
      await Product.findOneAndUpdate(
        { _id: item.productId, 'variants.sku': item.variantSku },
        { $inc: { 'variants.$.stock': -item.quantity } }
      );
    }

    sale.voidedAt = undefined;
    sale.voidedBy = undefined;
    await sale.save();

    return res.status(200).json(sale);
  } catch (error) {
    console.error('Unvoid sale error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
