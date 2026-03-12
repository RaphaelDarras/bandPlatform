const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticateToken } = require('../middleware/auth');

// GET / - Get all active products (public)
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

// GET /:id - Get product by ID (public)
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

// POST / - Create new product (protected)
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

    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - Update product (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { stock, ...allowedUpdates } = req.body;

    // Prevent direct stock updates
    if (stock !== undefined) {
      return res.status(400).json({
        error: 'Direct stock updates not allowed. Use /api/inventory endpoints.'
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      allowedUpdates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(product);
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

    res.status(200).json({ message: 'Product deactivated' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
