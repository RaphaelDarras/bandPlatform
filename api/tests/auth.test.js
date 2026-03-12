'use strict';

/**
 * Unit tests for POST /api/auth/login and POST /api/auth/verify
 */

// Mock mongoose to avoid real DB connection
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue({}),
    Schema: actual.Schema,
    model: jest.fn(),
  };
});

// Mock Admin model
const mockAdminModule = {
  findOne: jest.fn(),
};
jest.mock('../models/Admin', () => mockAdminModule);

// Mock jsonwebtoken — use real sign for login tests, mock verify for auth middleware bypass
const realJwt = jest.requireActual('jsonwebtoken');
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('generated-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'user1', username: 'admin', role: 'admin' }),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  const authRouter = require('../routes/auth');
  app.use('/api/auth', authRouter);
  return app;
}

const AUTH_HEADER = 'Bearer test-token';

describe('POST /api/auth/login', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username and password/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username and password/i);
  });

  it('returns 401 for unknown user', async () => {
    mockAdminModule.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'secret' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 401 for wrong password', async () => {
    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      comparePassword: jest.fn().mockResolvedValue(false),
      save: jest.fn(),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 200 with JWT on valid credentials', async () => {
    const jwt = require('jsonwebtoken');
    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      comparePassword: jest.fn().mockResolvedValue(true),
      save: jest.fn(),
      lastLogin: null,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'correct' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('generated-jwt-token');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('admin');
    expect(jwt.sign).toHaveBeenCalled();
  });
});

describe('POST /api/auth/verify', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset verify mock for auth middleware
    const jwt = require('jsonwebtoken');
    jwt.verify.mockReturnValue({ userId: 'user1', username: 'admin', role: 'admin' });
  });

  it('returns 401 without token', async () => {
    const jwt = require('jsonwebtoken');
    // Make verify throw so middleware rejects
    jwt.verify.mockImplementation(() => { throw new Error('no token'); });

    const res = await request(app)
      .post('/api/auth/verify');

    // No Authorization header -> 401
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.user).toBeDefined();
  });
});
