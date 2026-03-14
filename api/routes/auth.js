const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Authenticate admin credentials and receive JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify JWT token
 *     description: Validate JWT token and return user information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid or missing token
 *       403:
 *         description: Token verification failed
 */
router.post('/verify', authenticateToken, (req, res) => {
  res.status(200).json({
    valid: true,
    user: req.user
  });
});

/**
 * POST /api/auth/pin-setup
 * Authenticated. Sets a bcrypt-hashed PIN on the current admin account.
 */
router.post('/pin-setup', authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;

    // Validate pin: must be string of 4-6 digits
    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    // Find the authenticated admin
    const admin = await Admin.findOne({ _id: req.user.userId, active: true });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Hash the PIN and store it
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    admin.pinHash = await bcrypt.hash(pin, salt);
    await admin.save();

    return res.status(200).json({ message: 'PIN set successfully' });
  } catch (error) {
    console.error('PIN setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/pin-login
 * Public. Authenticates admin by PIN and returns a 24h JWT.
 */
router.post('/pin-login', async (req, res) => {
  try {
    const { pin } = req.body;

    // Find the single active admin
    const admin = await Admin.findOne({ active: true });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Check PIN is configured
    if (!admin.pinHash) {
      return res.status(400).json({ error: 'PIN not configured' });
    }

    // Compare PIN
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(String(pin), admin.pinHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Update lastLogin
    admin.lastLogin = new Date();
    await admin.save();

    // Generate 24h JWT
    const token = jwt.sign(
      {
        userId: admin._id,
        username: admin.username,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: admin._id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('PIN login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
