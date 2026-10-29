const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

const VARIANT_GID_RE = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const PRODUCT_GID_RE = /^gid:\/\/shopify\/Product\/\d+$/;

/**
 * Whitelist + validate one sale line (T-07.1-01). Typed copies only; unknown
 * keys are dropped (mass-assignment guard).
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
function sanitizeSaleItem(item) {
  if (!item || typeof item !== 'object') return { ok: false, error: 'Invalid item' };

  const { quantity, priceAtSale } = item;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'Invalid quantity' };
  }
  if (typeof priceAtSale !== 'number' || !Number.isFinite(priceAtSale) || priceAtSale < 0) {
    return { ok: false, error: 'Invalid priceAtSale' };
  }

  const value = {
    variantSku: String(item.variantSku ?? '').slice(0, 200),
    quantity,
    priceAtSale,
  };

  if (typeof item.productName === 'string') value.productName = item.productName.trim().slice(0, 200);
  if (typeof item.variantLabel === 'string') value.variantLabel = item.variantLabel.trim().slice(0, 200);
  if (typeof item.variantGid === 'string' && VARIANT_GID_RE.test(item.variantGid)) {
    value.variantGid = item.variantGid;
  }
  if (typeof item.productGid === 'string' && PRODUCT_GID_RE.test(item.productGid)) {
    value.productGid = item.productGid;
  }
  if (
    Number.isInteger(item.appliedDelta) &&
    item.appliedDelta <= 0 &&
    item.appliedDelta >= -quantity
  ) {
    value.appliedDelta = item.appliedDelta;
  }
  // Legacy lines from old APKs only
  if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
    value.productId = item.productId;
  }

  return { ok: true, value };
}

/** Normalise a Shopify id to a GID; undefined when unusable. */
function toGid(kind, id) {
  if (id === undefined || id === null) return undefined;
  const str = String(id);
  if (str.startsWith('gid://shopify/')) return str;
  if (/^\d+$/.test(str)) return `gid://shopify/${kind}/${str}`;
  return undefined;
}

/**
 * Attach readable names to pre-07.1 lines (no snapshot) from the archived,
 * read-only Product collection (D-21, D-08). Mutates the lean objects in
 * memory only — nothing is persisted. One batched lookup (T-07.1-05).
 */
async function enrichLegacyLines(sales) {
  const ids = new Set();
  for (const sale of sales) {
    for (const item of sale.items || []) {
      if (!item.productName && item.productId) ids.add(String(item.productId));
    }
  }
  if (ids.size === 0) return;

  const products = await Product.find({ _id: { $in: [...ids] } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  for (const sale of sales) {
    for (const item of sale.items || []) {
      if (item.productName || !item.productId) continue;
      const product = byId.get(String(item.productId));
      if (!product) continue;
      const variant = (product.variants || []).find((v) => v.sku === item.variantSku);
      item.productName = product.name;
      item.variantLabel = variant
        ? ([variant.size, variant.color].filter(Boolean).join(' / ') || item.variantSku)
        : item.variantSku;
      const productGid = toGid('Product', product.shopifyProductId);
      if (productGid) item.productGid = productGid;
      const variantGid = variant ? toGid('ProductVariant', variant.shopifyVariantId) : undefined;
      if (variantGid) item.variantGid = variantGid;
    }
  }
}

/**
 * POST /api/sales/batch
 * Submit a batch of offline sales with idempotency key deduplication.
 * Duplicates (matching idempotencyKey) are silently skipped.
 * Stock lives in Shopify (07.1); this route records sales only and never adjusts stock.
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
      const { concertId, items, totalAmount, paymentMethod, paymentSplit, idempotencyKey, currency, discount, discountType } = saleData;

      // Check for duplicate idempotencyKey
      if (idempotencyKey) {
        const existing = await Sale.findOne({ idempotencyKey });
        if (existing) {
          skipped++;
          continue;
        }
      }

      // Validate + whitelist every line before creating anything
      const resolvedItems = [];
      const rawItems = Array.isArray(items) ? items : [];
      for (let index = 0; index < rawItems.length; index++) {
        const result = sanitizeSaleItem(rawItems[index]);
        if (!result.ok) {
          return res.status(400).json({ error: 'Invalid sale item', index });
        }
        resolvedItems.push(result.value);
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
      if (paymentSplit && Array.isArray(paymentSplit)) createPayload.paymentSplit = paymentSplit;

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
 * PATCH /api/sales/:id/applied
 * Record the per-line stock delta Shopify actually applied (D-12/D-13).
 * Body: { lines: [{ lineIndex, appliedDelta }] }. 404 until the sale is synced
 * (the mobile outbox retries).
 */
router.patch('/:id/applied', async (req, res) => {
  try {
    const lines = req.body && req.body.lines;
    const valid =
      Array.isArray(lines) &&
      lines.length > 0 &&
      lines.length <= 100 &&
      lines.every(
        (l) =>
          l &&
          Number.isInteger(l.lineIndex) && l.lineIndex >= 0 && l.lineIndex <= 99 &&
          Number.isInteger(l.appliedDelta) && l.appliedDelta <= 0
      );
    if (!valid) return res.status(400).json({ error: 'Invalid applied lines' });

    const $set = {};
    for (const l of lines) $set[`items.${l.lineIndex}.appliedDelta`] = l.appliedDelta;

    const sale = await Sale.findOneAndUpdate(
      { idempotencyKey: `sale_create:${req.params.id}` },
      { $set },
      { new: true }
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    return res.status(200).json(sale);
  } catch (error) {
    console.error('Update applied delta error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
 * Returns POS sales only — online orders live in Shopify (D-16).
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.concertId) {
      filter.concertId = req.query.concertId;
    }

    const sales = await Sale.find(filter).sort({ createdAt: -1 }).lean();
    try {
      await enrichLegacyLines(sales);
    } catch (err) {
      console.warn('[sales] legacy name resolution failed', err.message);
    }
    return res.status(200).json(sales);
  } catch (error) {
    console.error('List sales error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sales/:id/void
 * Void a sale: sets voidedAt and voidedBy (flag only — stock is mirrored to
 * Shopify by the mobile outbox, D-13).
 */
router.post('/:id/void', async (req, res) => {
  try {
    // /:id may be a local UUID — try MongoDB _id first, then fall back to idempotencyKey lookup
    let sale = await Sale.findById(req.params.id).catch(() => null);
    if (!sale) {
      sale = await Sale.findOne({ idempotencyKey: `sale_create:${req.params.id}` });
    }
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.voidedAt) {
      return res.status(400).json({ error: 'Sale already voided' });
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
 * Unvoid a sale: clears voidedAt and voidedBy (flag only — stock is mirrored to
 * Shopify by the mobile outbox, D-13).
 */
router.post('/:id/unvoid', async (req, res) => {
  try {
    // /:id may be a local UUID — try MongoDB _id first, then fall back to idempotencyKey lookup
    let sale = await Sale.findById(req.params.id).catch(() => null);
    if (!sale) {
      sale = await Sale.findOne({ idempotencyKey: `sale_create:${req.params.id}` });
    }
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (!sale.voidedAt) {
      return res.status(400).json({ error: 'Sale is not voided' });
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
module.exports.sanitizeSaleItem = sanitizeSaleItem;
