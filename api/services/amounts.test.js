'use strict';

/**
 * Unit tests for currency-unit conversion helpers (Phase 06-03, D-01).
 * Covers the float-rounding edge (19.1) and the type distinction
 * (integer vs string) that RESEARCH.md's Pitfall 2 flags as the
 * 100x-mischarge risk.
 */

const { toStripeMinorUnits, toPaypalAmountString } = require('./amounts');

describe('toStripeMinorUnits', () => {
  it('converts 19.99 EUR to 1999 integer cents', () => {
    expect(toStripeMinorUnits(19.99)).toBe(1999);
  });

  it('converts 19.1 EUR to 1910, guarding float drift (19.1 * 100 !== 1910 exactly)', () => {
    // Without Math.round, 19.1 * 100 === 1909.9999999999998
    expect(toStripeMinorUnits(19.1)).toBe(1910);
  });

  it('always returns an integer, never a float', () => {
    const result = toStripeMinorUnits(19.1);
    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });

  it('handles a whole-euro amount', () => {
    expect(toStripeMinorUnits(20)).toBe(2000);
  });
});

describe('toPaypalAmountString', () => {
  it('converts 19.99 EUR to the decimal string "19.99"', () => {
    expect(toPaypalAmountString(19.99)).toBe('19.99');
  });

  it('converts 19.1 EUR to the 2-decimal string "19.10"', () => {
    expect(toPaypalAmountString(19.1)).toBe('19.10');
  });

  it('always returns a string, never a number', () => {
    const result = toPaypalAmountString(19.1);
    expect(typeof result).toBe('string');
  });

  it('handles a whole-euro amount with trailing zeros', () => {
    expect(toPaypalAmountString(20)).toBe('20.00');
  });
});
