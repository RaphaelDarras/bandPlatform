const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { authenticateToken } = require('../middleware/auth');

// POST /login - Authenticate admin and return JWT token
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find admin with active status
    const admin = await Admin.findOne({ username, active: true });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update lastLogin
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: admin._id,
        username: admin.username,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return token and user info
    res.status(200).json({
      token,
      user: {
        id: admin._id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /verify - Verify JWT token
router.post('/verify', authenticateToken, (req, res) => {
  res.status(200).json({
    valid: true,
    user: req.user
  });
});

module.exports = router;
