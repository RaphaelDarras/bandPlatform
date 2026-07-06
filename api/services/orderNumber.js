'use strict';

/**
 * Order number generation service (Phase 06-02, D-11).
 *
 * Generates short, HRK-prefixed, non-enumerable order numbers using
 * crypto.randomBytes (NEVER Math.random — not cryptographically strong,
 * see RESEARCH.md anti-pattern). Pairs with createOrderWithUniqueNumber()
 * to retry on a MongoDB duplicate-key error (E11000) against the unique
 * index on Order.orderNumber.
 */

const crypto = require('crypto');

// Excludes ambiguous characters 0/O and 1/I.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function generateOrderNumber() {
  const bytes = crypto.randomBytes(SUFFIX_LENGTH);
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `HRK-${suffix}`;
}

async function createOrderWithUniqueNumber(Model, data) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await Model.create({ ...data, orderNumber: generateOrderNumber() });
    } catch (err) {
      if (err && err.code === 11000) {
        lastError = err;
        continue; // duplicate key — retry with a fresh number
      }
      throw err; // any non-11000 error re-thrown immediately, no retry
    }
  }
  throw lastError;
}

module.exports = { generateOrderNumber, createOrderWithUniqueNumber };
