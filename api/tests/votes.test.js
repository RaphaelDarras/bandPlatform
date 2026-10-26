'use strict';

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

const mockVoteModule = {
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
};
jest.mock('../models/Vote', () => mockVoteModule);

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/votes', require('../routes/votes'));
  return app;
}

let app;
beforeAll(() => {
  app = buildApp();
});

function mockDocs(docs) {
  mockVoteModule.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDocs([]);
  mockVoteModule.findOneAndUpdate.mockResolvedValue({});
});

describe('GET /api/votes', () => {
  it('returns zeros when empty', async () => {
    const res = await request(app).get('/api/votes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ counts: { a: 0, b: 0, c: 0, d: 0 }, total: 0 });
  });

  it('aggregates counts and ignores stray choices', async () => {
    mockDocs([
      { choice: 'a', count: 3 },
      { choice: 'c', count: 1 },
      { choice: 'zzz', count: 99 },
    ]);
    const res = await request(app).get('/api/votes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ counts: { a: 3, b: 0, c: 1, d: 0 }, total: 4 });
  });

  it('returns 500 when the model throws', async () => {
    mockVoteModule.find.mockImplementation(() => {
      throw new Error('boom');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/votes');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('POST /api/votes', () => {
  it('casts a vote with an atomic upsert-$inc and returns the tally', async () => {
    mockDocs([{ choice: 'b', count: 1 }]);
    const res = await request(app).post('/api/votes').send({ choice: 'b' });
    expect(res.status).toBe(201);
    expect(mockVoteModule.findOneAndUpdate).toHaveBeenCalledWith(
      { choice: 'b' },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    expect(res.body).toEqual({ counts: { a: 0, b: 1, c: 0, d: 0 }, total: 1 });
  });

  it.each([
    ['unknown id', { choice: 'z' }],
    ['missing choice', {}],
    ['number', { choice: 1 }],
    ['operator object', { choice: { $ne: null } }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await request(app).post('/api/votes').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid choice' });
    expect(mockVoteModule.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when the model throws', async () => {
    mockVoteModule.findOneAndUpdate.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/votes').send({ choice: 'a' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('DELETE /api/votes', () => {
  it('zeroes every count and returns the empty tally', async () => {
    mockVoteModule.updateMany.mockResolvedValue({ modifiedCount: 4 });
    mockDocs([
      { choice: 'a', count: 0 },
      { choice: 'b', count: 0 },
    ]);
    const res = await request(app).delete('/api/votes');
    expect(res.status).toBe(200);
    expect(mockVoteModule.updateMany).toHaveBeenCalledWith({}, { $set: { count: 0 } });
    expect(res.body).toEqual({ counts: { a: 0, b: 0, c: 0, d: 0 }, total: 0 });
  });

  it('returns 500 when the model throws', async () => {
    mockVoteModule.updateMany.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).delete('/api/votes');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
