const express = require('express');
const router = express.Router();
const Concert = require('../models/Concert');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/concerts
 * Returns list of concerts sorted by date descending.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const concerts = await Concert.find().sort({ date: -1 });
    return res.status(200).json(concerts);
  } catch (error) {
    console.error('Get concerts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/concerts
 * Creates a new concert. Requires name, date, city (city maps to location field).
 * venue is optional.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { date, country, city, venue, currency } = req.body;

    if (!date || !country || !city) {
      return res.status(400).json({ error: 'date, country, and city are required' });
    }

    const concert = await Concert.create({
      date,
      country,
      city,
      venue,
      currency,
    });

    return res.status(201).json(concert);
  } catch (error) {
    console.error('Create concert error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/concerts/:id
 * Returns a single concert by ID.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id);
    if (!concert) {
      return res.status(404).json({ error: 'Concert not found' });
    }
    return res.status(200).json(concert);
  } catch (error) {
    console.error('Get concert error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/concerts/:id
 * Updates allowed fields on a concert (name, venue, date, location, active).
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const allowedFields = ['venue', 'date', 'country', 'city', 'active', 'currency', 'priceOverrides'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const concert = await Concert.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!concert) {
      return res.status(404).json({ error: 'Concert not found' });
    }

    return res.status(200).json(concert);
  } catch (error) {
    console.error('Update concert error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
