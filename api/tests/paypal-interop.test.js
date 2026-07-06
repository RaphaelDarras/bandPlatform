'use strict';

/**
 * CJS interop guard for @paypal/paypal-server-sdk (Phase 6 RESEARCH Open Question 2 / Assumption A1).
 *
 * The SDK's docs show ESM usage, but this codebase's `api/package.json` declares
 * "type": "commonjs". This test proves a plain `require('@paypal/paypal-server-sdk')`
 * (or its `.default` wrapper, if the package ships one) exposes the four symbols
 * downstream plans (03: PayPal client/order creation) need:
 *   - Client (constructor)
 *   - OrdersController (constructor)
 *   - Environment (enum: Sandbox/Production)
 *   - CheckoutPaymentIntent (enum: Capture/Authorize)
 *
 * Does NOT hit the network — this is a pure require()/typeof/shape assertion.
 */

describe('@paypal/paypal-server-sdk CJS interop', () => {
  // eslint-disable-next-line global-require
  const sdk = require('@paypal/paypal-server-sdk');

  // Resolve the access path: prefer the module's own named exports, fall back to
  // `.default` in case a future SDK version wraps everything behind an ESM interop
  // default export. Fail loudly (not silently `undefined`) if neither exposes the
  // symbols we need.
  const source = sdk && sdk.Client ? sdk : sdk && sdk.default;

  test('require() resolves a usable export source (no .default indirection needed)', () => {
    expect(source).toBeDefined();
    // Document which access path actually worked, for Plan 03's implementation.
    expect(source).toBe(sdk); // confirms top-level require() exposes everything directly
  });

  test('Client is a constructor function', () => {
    expect(typeof source.Client).toBe('function');
  });

  test('OrdersController is a constructor function', () => {
    expect(typeof source.OrdersController).toBe('function');
  });

  test('Environment enum exposes Sandbox and Production', () => {
    expect(source.Environment).toBeDefined();
    expect(source.Environment.Sandbox).toBeDefined();
    expect(source.Environment.Production).toBeDefined();
  });

  test('CheckoutPaymentIntent enum exposes Capture', () => {
    expect(source.CheckoutPaymentIntent).toBeDefined();
    expect(source.CheckoutPaymentIntent.Capture).toBeDefined();
  });
});
