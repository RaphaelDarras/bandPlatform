'use strict';

const { selectPhase7Webhooks } = require('../scripts/shopifyTeardownWebhooks');

describe('selectPhase7Webhooks', () => {
  it('returns only Phase 7 webhook subscriptions', () => {
    const out = selectPhase7Webhooks([
      { id: 'a', topic: 'ORDERS_PAID', callbackUrl: 'https://x.onrender.com/api/shopify/webhooks/orders-paid' },
      { id: 'b', topic: 'APP_UNINSTALLED', callbackUrl: 'https://other/hook' },
    ]);
    expect(out.map((s) => s.id)).toEqual(['a']);
  });

  it('matches nested endpoint.callbackUrl', () => {
    const out = selectPhase7Webhooks([
      { id: 'c', topic: 'PRODUCTS_UPDATE', endpoint: { callbackUrl: 'https://x/api/shopify/webhooks/products-update' } },
    ]);
    expect(out.map((s) => s.id)).toEqual(['c']);
  });

  it('returns [] for an empty list', () => {
    expect(selectPhase7Webhooks([])).toEqual([]);
  });
});
