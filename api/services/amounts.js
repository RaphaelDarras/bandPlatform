'use strict';

/**
 * Currency-unit conversion helpers (Phase 06-03, D-01, RESEARCH Pitfall 2).
 *
 * Stripe and PayPal use two DIFFERENT amount conventions for the same EUR
 * value:
 *   - Stripe wants an INTEGER in the currency's smallest unit (cents): 1999
 *   - PayPal wants a DECIMAL STRING in the currency's major unit: "19.99"
 *
 * These two helpers are kept in ONE file, with deliberately distinct names,
 * specifically so the two conventions can never be silently swapped — mixing
 * them up causes a 100x mischarge (RESEARCH.md Common Pitfalls #2).
 *
 * Math.round guards against float drift, e.g. 19.1 * 100 === 1909.9999999999998
 * without it.
 */

function toStripeMinorUnits(eur) {
  return Math.round(eur * 100);
}

function toPaypalAmountString(eur) {
  return eur.toFixed(2);
}

module.exports = { toStripeMinorUnits, toPaypalAmountString };
