const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate JWT tokens from Authorization header
 *
 * Expected header format: "Bearer {token}"
 *
 * On success: attaches decoded user payload to req.user
 * On failure: returns 401 (no token) or 403 (invalid/expired token)
 *
 * Token payload structure:
 * - userId: Admin's ObjectId
 * - username: Admin's username
 * - role: Admin's role
 * - iat: Issued at timestamp (automatic)
 * - exp: Expiration timestamp (automatic)
 */
function authenticateToken(req, res, next) {
  // Extract Authorization header
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Extract token from "Bearer {token}" format
  const token = authHeader.split(' ')[1];

  // Check if token was provided
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Verify token using JWT_SECRET
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user payload to request object
    req.user = decoded;

    // Continue to next middleware or route handler
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Generic error
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
