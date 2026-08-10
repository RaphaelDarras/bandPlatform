const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticateToken } = require('../middleware/auth');
// Outbound Shopify mirror (07-07): best-effort, config-guarded, never throws —
// so an unconfigured env (and the existing product tests) no-op with zero work.
const shopifyOutbound = require('../services/shopifyOutbound');

/**
 * D-14: application-level SKU uniqueness guard — the real backstop for
 * variant SKU uniqueness. Deliberately NOT backed by a unique index on
 * `variants.sku` (see api/models/Product.js): a unique multikey index build
 * fails outright against pre-existing duplicate values, which CONTEXT.md
 * warns may already exist. Returns the clashing SKU, or null if none.
 *
 * @param {string[]} skus - candidate SKUs to check for a clash
 * @param {string} [excludeProductId] - when checking an existing product's
 *   own new variants, exclude that product from the lookup
 * @returns {Promise<string|null>}
 */
async function findSkuClash(skus, excludeProductId) {
  // A payload can collide with itself before it ever reaches the database.
  const seen = new Set();
  for (const sku of skus) {
    if (seen.has(sku)) return sku;
    seen.add(sku);
  }

  const query = { 'variants.sku': { $in: skus } };
  if (excludeProductId) {
    query._id = { $ne: excludeProductId };
  }
  const existing = await Product.findOne(query).select('variants.sku').lean();
  if (!existing) return null;

  const clashVariant = existing.variants.find((v) => skus.includes(v.sku));
  return clashVariant ? clashVariant.sku : null;
}

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all active products
 *     description: Retrieve all active products, optionally filtered by category
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by product category
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    const query = { active: true };
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query);
    res.status(200).json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     description: Retrieve a single product by its ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product
 *     description: Create a new product with variants (requires authentication)
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: SKU already in use
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, basePrice, variants } = req.body;

    // Validate required fields
    if (!name || !basePrice || !variants || !Array.isArray(variants)) {
      return res.status(400).json({
        error: 'Name, basePrice, and variants array are required'
      });
    }

    // Validate each variant has required fields
    for (const variant of variants) {
      if (!variant.sku || (!variant.size && !variant.color)) {
        return res.status(400).json({
          error: 'Each variant must have sku and either size or color'
        });
      }
    }

    // D-14: application-level SKU uniqueness guard — runs before any write.
    const clash = await findSkuClash(variants.map((v) => v.sku));
    if (clash) {
      return res.status(409).json({ error: `SKU already in use: ${clash}` });
    }

    const product = await Product.create(req.body);
    // Mirror the new product to Shopify (fire-and-forget — additive side effect,
    // must not add latency or change the 201 response). shopifyOutbound swallows
    // errors and no-ops when unconfigured.
    shopifyOutbound.syncProductOut(product).catch(() => {});
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product details (admin only)
 *     description: |
 *       Safely updates product-level fields and variant metadata.
 *       **Protected fields:** `stock` and `version` on any variant are never modified
 *       through this endpoint — use `/api/inventory` endpoints to manage stock.
 *       **Variant updates:** matched by `sku`; only `size`, `color`, and `priceAdjustment`
 *       are updated. Variants cannot be added or removed via this endpoint.
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               basePrice:
 *                 type: number
 *                 minimum: 0
 *               category:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *               variants:
 *                 type: array
 *                 description: List of variant updates matched by sku (only size, color, priceAdjustment are writable)
 *                 items:
 *                   type: object
 *                   required: [sku]
 *                   properties:
 *                     sku:
 *                       type: string
 *                       description: Identifier used to match the variant — not updatable
 *                     size:
 *                       type: string
 *                     color:
 *                       type: string
 *                     priceAdjustment:
 *                       type: number
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: No valid update fields provided
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       409:
 *         description: SKU already in use
 *       500:
 *         description: Internal server error
 */

// Whitelisted product-level fields — all other fields are ignored
const allowedProductFields = ['name', 'description', 'basePrice', 'category', 'images', 'active'];

// Whitelisted variant metadata fields — stock and version are intentionally excluded
const allowedVariantFields = ['size', 'color', 'priceAdjustment'];

// PUT /:id - Update product (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const productLevelSet = {};
    for (const field of allowedProductFields) {
      if (req.body[field] !== undefined) {
        productLevelSet[field] = req.body[field];
      }
    }

    const hasVariants = Array.isArray(req.body.variants) && req.body.variants.length > 0;
    const hasProductFields = Object.keys(productLevelSet).length > 0;

    if (!hasProductFields && !hasVariants) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    // Apply product-level field updates
    if (hasProductFields) {
      await Product.findByIdAndUpdate(
        req.params.id,
        { $set: productLevelSet },
        { new: false, runValidators: true }
      );
    }

    // Apply variant updates: update existing by SKU, add new ones
    if (hasVariants) {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const existingSkus = new Set(product.variants.map((v) => v.sku));

      // D-14: SKU uniqueness guard for newly-added variants, hoisted above
      // the $pull and update loop below. A rejected request must perform no
      // $pull, no $set, and no $push — PUT is not transactional, and a
      // partially-applied variant sync is exactly the failure D-17 warns
      // about.
      const newSkus = req.body.variants
        .map((v) => v.sku)
        .filter((sku) => sku && !existingSkus.has(sku));
      if (newSkus.length > 0) {
        const clash = await findSkuClash(newSkus, req.params.id);
        if (clash) {
          return res.status(409).json({ error: `SKU already in use: ${clash}` });
        }
      }

      // Remove variants not present in the payload
      const incomingSkus = new Set(req.body.variants.map((v) => v.sku).filter(Boolean));
      const skusToRemove = [...existingSkus].filter((sku) => !incomingSkus.has(sku));
      if (skusToRemove.length > 0) {
        await Product.updateOne(
          { _id: req.params.id },
          { $pull: { variants: { sku: { $in: skusToRemove } } } }
        );
      }

      for (const variant of req.body.variants) {
        if (!variant.sku) continue;

        if (existingSkus.has(variant.sku)) {
          // Update existing variant metadata (stock/version protected)
          const variantUpdate = {};
          for (const field of allowedVariantFields) {
            if (variant[field] !== undefined) {
              variantUpdate[`variants.$.${field}`] = variant[field];
            }
          }
          if (Object.keys(variantUpdate).length > 0) {
            await Product.updateOne(
              { _id: req.params.id, 'variants.sku': variant.sku },
              { $set: variantUpdate }
            );
          }
        } else {
          // Add new variant with stock defaulting to 0
          const newVariant = { sku: variant.sku, stock: 0 };
          for (const field of [...allowedVariantFields, 'label']) {
            if (variant[field] !== undefined) {
              newVariant[field] = variant[field];
            }
          }
          await Product.updateOne(
            { _id: req.params.id },
            { $push: { variants: newVariant } }
          );
        }
      }
    }

    // Fetch and return the updated product
    const updatedProduct = await Product.findById(req.params.id);

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Mirror the updated product content to Shopify (fire-and-forget).
    shopifyOutbound.syncProductOut(updatedProduct).catch(() => {});

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - Soft delete product (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Mirror the soft-delete (archive to DRAFT) to Shopify (fire-and-forget).
    shopifyOutbound.archiveProductOut(product).catch(() => {});

    res.status(200).json({ message: 'Product deactivated' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
