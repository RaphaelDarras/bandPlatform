'use strict';

/**
 * Unit tests for orderNumber generation service (Phase 06-02, D-11).
 * Verifies crypto-random HRK-prefixed order numbers and collision-retry behavior.
 */

const { generateOrderNumber, createOrderWithUniqueNumber } = require('./orderNumber');

describe('generateOrderNumber', () => {
  it('returns a string matching /^HRK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/', () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^HRK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('never contains ambiguous characters 0, O, 1, or I', () => {
    for (let i = 0; i < 200; i++) {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).not.toMatch(/[0O1I]/);
    }
  });

  it('produces effectively unique, non-sequential values across 1000 calls', () => {
    const values = new Set();
    for (let i = 0; i < 1000; i++) {
      values.add(generateOrderNumber());
    }
    // Collisions are possible in theory (33^6 space) but should not occur in 1000 draws.
    expect(values.size).toBe(1000);

    // Non-sequential: consecutive suffixes should not be alphabet-adjacent runs.
    const suffixes = Array.from(values).slice(0, 50).map((v) => v.replace('HRK-', ''));
    const sorted = [...suffixes].sort();
    expect(suffixes).not.toEqual(sorted);
  });
});

describe('createOrderWithUniqueNumber', () => {
  it('creates successfully on the first attempt when no collision occurs', async () => {
    const create = jest.fn().mockResolvedValue({ orderNumber: 'HRK-ABCDEF' });
    const Model = { create };

    const result = await createOrderWithUniqueNumber(Model, { customerEmail: 'a@b.com' });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.orderNumber).toBe('HRK-ABCDEF');
  });

  it('retries exactly once when create() throws a duplicate-key (11000) error once then succeeds', async () => {
    const duplicateError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const create = jest
      .fn()
      .mockRejectedValueOnce(duplicateError)
      .mockResolvedValueOnce({ orderNumber: 'HRK-GHJKLM' });
    const Model = { create };

    const result = await createOrderWithUniqueNumber(Model, { customerEmail: 'a@b.com' });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.orderNumber).toBe('HRK-GHJKLM');
  });

  it('re-throws a non-11000 error immediately without retrying', async () => {
    const otherError = new Error('Some validation error');
    const create = jest.fn().mockRejectedValue(otherError);
    const Model = { create };

    await expect(
      createOrderWithUniqueNumber(Model, { customerEmail: 'a@b.com' })
    ).rejects.toThrow('Some validation error');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('gives up after 5 attempts if every attempt collides', async () => {
    const duplicateError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const create = jest.fn().mockRejectedValue(duplicateError);
    const Model = { create };

    await expect(
      createOrderWithUniqueNumber(Model, { customerEmail: 'a@b.com' })
    ).rejects.toThrow('E11000 duplicate key');
    expect(create).toHaveBeenCalledTimes(5);
  });

  it('each retry attempt calls create with a different generated orderNumber', async () => {
    const duplicateError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const create = jest
      .fn()
      .mockRejectedValueOnce(duplicateError)
      .mockResolvedValueOnce({ orderNumber: 'HRK-XXXXXX' });
    const Model = { create };

    await createOrderWithUniqueNumber(Model, { customerEmail: 'a@b.com' });

    const firstCallArg = create.mock.calls[0][0];
    const secondCallArg = create.mock.calls[1][0];
    expect(firstCallArg.orderNumber).not.toBe(secondCallArg.orderNumber);
    expect(firstCallArg.customerEmail).toBe('a@b.com');
    expect(secondCallArg.customerEmail).toBe('a@b.com');
  });
});
