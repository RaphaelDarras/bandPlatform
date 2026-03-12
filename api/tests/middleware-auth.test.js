'use strict';

/**
 * Unit tests for authenticateToken middleware
 */

const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

process.env.JWT_SECRET = 'test-secret';

function mockReqResNext() {
  const req = { headers: {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('authenticateToken middleware', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 401 when no Authorization header', () => {
    const { req, res, next } = mockReqResNext();

    authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/access token required/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has no token (just "Bearer")', () => {
    const { req, res, next } = mockReqResNext();
    req.headers.authorization = 'Bearer';

    authenticateToken(req, res, next);

    // "Bearer".split(' ')[1] is undefined
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for invalid token', () => {
    const { req, res, next } = mockReqResNext();
    req.headers.authorization = 'Bearer invalid-token';

    authenticateToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for expired token', () => {
    const { req, res, next } = mockReqResNext();
    // Create a token that expired 1 hour ago
    const expiredToken = jwt.sign(
      { userId: 'u1', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' }
    );
    req.headers.authorization = `Bearer ${expiredToken}`;

    authenticateToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches decoded user to req and calls next on valid token', () => {
    const { req, res, next } = mockReqResNext();
    const validToken = jwt.sign(
      { userId: 'u1', username: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    req.headers.authorization = `Bearer ${validToken}`;

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('u1');
    expect(req.user.username).toBe('admin');
    expect(req.user.role).toBe('admin');
  });
});
