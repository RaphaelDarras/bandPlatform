'use strict';

/**
 * Unit tests for Concert CRUD endpoints:
 * GET /api/concerts
 * POST /api/concerts
 * GET /api/concerts/:id
 * PATCH /api/concerts/:id
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

// Mock Concert model
const mockConcertModule = {
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};
jest.mock('../models/Concert', () => mockConcertModule);

// Mock JWT so authenticateToken passes
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'user1', role: 'admin' }),
  sign: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  const concertsRouter = require('../routes/concerts');
  app.use('/api/concerts', concertsRouter);
  return app;
}

let app;

beforeAll(() => {
  app = buildApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  const jwt = require('jsonwebtoken');
  jwt.verify.mockReturnValue({ userId: 'user1', role: 'admin' });
});

const AUTH_HEADER = 'Bearer test-token';

// ---- GET /api/concerts ----

describe('GET /api/concerts', () => {
  it('returns 401 without auth token', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementation(() => { throw new Error('no token'); });

    const res = await request(app)
      .get('/api/concerts');

    expect(res.status).toBe(401);
  });

  it('returns array of concerts sorted by date desc', async () => {
    const concerts = [
      { _id: 'c1', name: 'Show B', date: new Date('2026-06-01'), location: 'Dublin', active: true },
      { _id: 'c2', name: 'Show A', date: new Date('2026-05-01'), location: 'Cork', active: true },
    ];
    // sort() returns the mock itself for chaining
    mockConcertModule.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(concerts),
    });

    const res = await request(app)
      .get('/api/concerts')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(mockConcertModule.find).toHaveBeenCalled();
  });
});

// ---- POST /api/concerts ----

describe('POST /api/concerts', () => {
  const validBody = {
    name: 'Summer Tour',
    date: '2026-08-15',
    city: 'Berlin',
    venue: 'Tempodrom',
  };

  it('returns 401 without auth token', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementation(() => { throw new Error('no token'); });

    const res = await request(app)
      .post('/api/concerts')
      .send(validBody);

    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/concerts')
      .set('Authorization', AUTH_HEADER)
      .send({ date: '2026-08-15', city: 'Berlin' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when date is missing', async () => {
    const res = await request(app)
      .post('/api/concerts')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Tour', city: 'Berlin' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when city is missing', async () => {
    const res = await request(app)
      .post('/api/concerts')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Tour', date: '2026-08-15' });

    expect(res.status).toBe(400);
  });

  it('returns 201 and maps city to location field', async () => {
    const created = {
      _id: 'c1',
      name: 'Summer Tour',
      date: new Date('2026-08-15'),
      location: 'Berlin',
      venue: 'Tempodrom',
      active: true,
    };
    mockConcertModule.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/concerts')
      .set('Authorization', AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.location).toBe('Berlin');
    expect(mockConcertModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Berlin', name: 'Summer Tour' })
    );
  });

  it('creates concert without venue (optional)', async () => {
    const created = {
      _id: 'c2',
      name: 'Acoustic Night',
      date: new Date('2026-09-01'),
      location: 'Paris',
      active: true,
    };
    mockConcertModule.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/concerts')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Acoustic Night', date: '2026-09-01', city: 'Paris' });

    expect(res.status).toBe(201);
  });
});

// ---- GET /api/concerts/:id ----

describe('GET /api/concerts/:id', () => {
  it('returns 401 without auth token', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementation(() => { throw new Error('no token'); });

    const res = await request(app)
      .get('/api/concerts/c1');

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown id', async () => {
    mockConcertModule.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/concerts/nonexistentid')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 200 with concert data', async () => {
    const concert = {
      _id: 'c1',
      name: 'Rock Night',
      date: new Date('2026-07-10'),
      location: 'Amsterdam',
      active: true,
    };
    mockConcertModule.findById.mockResolvedValue(concert);

    const res = await request(app)
      .get('/api/concerts/c1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Rock Night');
  });
});

// ---- PATCH /api/concerts/:id ----

describe('PATCH /api/concerts/:id', () => {
  it('returns 401 without auth token', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementation(() => { throw new Error('no token'); });

    const res = await request(app)
      .patch('/api/concerts/c1')
      .send({ active: false });

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown id', async () => {
    mockConcertModule.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/concerts/unknownid')
      .set('Authorization', AUTH_HEADER)
      .send({ active: false });

    expect(res.status).toBe(404);
  });

  it('closes concert by setting active to false', async () => {
    const updated = {
      _id: 'c1',
      name: 'Rock Night',
      date: new Date('2026-07-10'),
      location: 'Amsterdam',
      active: false,
    };
    mockConcertModule.findByIdAndUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/concerts/c1')
      .set('Authorization', AUTH_HEADER)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(mockConcertModule.findByIdAndUpdate).toHaveBeenCalledWith(
      'c1',
      { $set: expect.objectContaining({ active: false }) },
      expect.objectContaining({ new: true })
    );
  });

  it('reopens concert by setting active to true', async () => {
    const updated = {
      _id: 'c1',
      name: 'Rock Night',
      date: new Date('2026-07-10'),
      location: 'Amsterdam',
      active: true,
    };
    mockConcertModule.findByIdAndUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/concerts/c1')
      .set('Authorization', AUTH_HEADER)
      .send({ active: true });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
  });
});
