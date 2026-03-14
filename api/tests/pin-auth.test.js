'use strict';

/**
 * Unit tests for PIN auth endpoints:
 * POST /api/auth/pin-setup
 * POST /api/auth/pin-login
 */

// Mock mongoose
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue({}),
    Schema: actual.Schema,
    model: jest.fn(),
    Types: actual.Types,
  };
});

// Mock Admin model
const mockAdminModule = {
  findOne: jest.fn(),
};
jest.mock('../models/Admin', () => mockAdminModule);

// Mock bcrypt
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpin'),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
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
  // Clear module cache so auth router is freshly loaded each test suite build
  jest.resetModules();
  // Re-require after mock setup
  const authRouter = require('../routes/auth');
  app.use('/api/auth', authRouter);
  return app;
}

let app;

beforeAll(() => {
  app = buildApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: jwt.verify passes
  const jwt = require('jsonwebtoken');
  jwt.verify.mockReturnValue({ userId: 'user1', username: 'admin', role: 'admin' });
});

const AUTH_HEADER = 'Bearer test-token';

// ---- POST /api/auth/pin-setup ----

describe('POST /api/auth/pin-setup', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/auth/pin-setup')
      .send({ pin: '1234' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for PIN shorter than 4 digits', async () => {
    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      save: jest.fn(),
    });

    const res = await request(app)
      .post('/api/auth/pin-setup')
      .set('Authorization', AUTH_HEADER)
      .send({ pin: '123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for PIN longer than 6 digits', async () => {
    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      save: jest.fn(),
    });

    const res = await request(app)
      .post('/api/auth/pin-setup')
      .set('Authorization', AUTH_HEADER)
      .send({ pin: '1234567' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for PIN with non-digit characters', async () => {
    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      save: jest.fn(),
    });

    const res = await request(app)
      .post('/api/auth/pin-setup')
      .set('Authorization', AUTH_HEADER)
      .send({ pin: '12ab' });

    expect(res.status).toBe(400);
  });

  it('returns 200 and stores hashed PIN for valid 4-digit PIN', async () => {
    const mockAdmin = {
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      pinHash: null,
      save: jest.fn().mockResolvedValue(true),
    };
    mockAdminModule.findOne.mockResolvedValue(mockAdmin);

    const bcrypt = require('bcrypt');
    bcrypt.hash.mockResolvedValue('$2b$10$hashedpin1234');

    const res = await request(app)
      .post('/api/auth/pin-setup')
      .set('Authorization', AUTH_HEADER)
      .send({ pin: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/pin set/i);
    expect(bcrypt.hash).toHaveBeenCalledWith('1234', expect.anything());
    expect(mockAdmin.save).toHaveBeenCalled();
  });

  it('returns 200 for valid 6-digit PIN', async () => {
    const mockAdmin = {
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      save: jest.fn().mockResolvedValue(true),
    };
    mockAdminModule.findOne.mockResolvedValue(mockAdmin);

    const res = await request(app)
      .post('/api/auth/pin-setup')
      .set('Authorization', AUTH_HEADER)
      .send({ pin: '123456' });

    expect(res.status).toBe(200);
  });
});

// ---- POST /api/auth/pin-login ----

describe('POST /api/auth/pin-login', () => {
  it('returns 400 when no PIN is configured on admin', async () => {
    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      pinHash: null,
    });

    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ pin: '1234' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pin not configured/i);
  });

  it('returns 401 for wrong PIN', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.compare.mockResolvedValue(false);

    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      pinHash: '$2b$10$hashedpin',
    });

    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ pin: '9999' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid pin/i);
  });

  it('returns 200 with token and user for correct PIN', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.compare.mockResolvedValue(true);

    const jwt = require('jsonwebtoken');
    jwt.sign.mockReturnValue('pin-jwt-token');

    mockAdminModule.findOne.mockResolvedValue({
      _id: 'admin1',
      username: 'admin',
      role: 'admin',
      pinHash: '$2b$10$hashedpin',
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ pin: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('pin-jwt-token');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('admin');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin1', username: 'admin', role: 'admin' }),
      expect.any(String),
      expect.objectContaining({ expiresIn: '24h' })
    );
  });

  it('returns 401 when no admin found', async () => {
    mockAdminModule.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ pin: '1234' });

    expect(res.status).toBe(401);
  });
});
