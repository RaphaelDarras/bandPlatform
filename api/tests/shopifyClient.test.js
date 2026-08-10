'use strict';

/**
 * Unit tests for the Shopify plumbing (Phase 07-04).
 *
 * Two independently-mocked concerns share this file:
 *   1. shopifyTokenCache.getAccessToken — real module, global `fetch` stubbed
 *      (client-credentials exchange + in-process cache/refresh, RESEARCH Pattern 2).
 *   2. shopifyClient.shopifyRequest    — `@shopify/admin-api-client` and
 *      `./shopifyTokenCache` mocked (authenticated GraphQL wrapper, Pattern 3).
 *
 * No network is hit and no real Shopify env values are required.
 */

describe('shopifyTokenCache.getAccessToken (client-credentials + cache)', () => {
  const OLD_ENV = process.env;
  let getAccessToken;
  let _resetCache;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.SHOPIFY_SHOP_DOMAIN = 'test-shop.myshopify.com';
    process.env.SHOPIFY_CLIENT_ID = 'test-client-id';
    process.env.SHOPIFY_CLIENT_SECRET = 'test-client-secret';
    // eslint-disable-next-line global-require
    ({ getAccessToken, _resetCache } = require('../services/shopifyTokenCache'));
    _resetCache();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('does NOT throw at require() time when Shopify env vars are unset (boot-safe)', () => {
    jest.resetModules();
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    delete process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_SECRET;
    // eslint-disable-next-line global-require
    expect(() => require('../services/shopifyTokenCache')).not.toThrow();
  });

  it('exchanges Client ID/Secret for a token on first call and returns it', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 't1', scope: 'read_products', expires_in: 86399 }),
    });

    const token = await getAccessToken();

    expect(token).toBe('t1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://test-shop.myshopify.com/admin/oauth/access_token');
    expect(opts.method).toBe('POST');
    // Body must carry the client-credentials grant (url-encoded).
    const body = opts.body.toString();
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=test-client-id');
    expect(body).toContain('client_secret=test-client-secret');
  });

  it('returns the cached token within the validity window WITHOUT a second fetch', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 't1', expires_in: 86399 }),
    });

    const first = await getAccessToken();
    const second = await getAccessToken();

    expect(first).toBe('t1');
    expect(second).toBe('t1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches a fresh token once the 5-minute refresh margin is crossed', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 't1', expires_in: 86399 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 't2', expires_in: 86399 }) });

    const first = await getAccessToken();
    expect(first).toBe('t1');

    // Jump to exactly the refresh boundary: expiresAt - 5min.
    nowSpy.mockReturnValue(1_000_000 + 86399 * 1000 - 5 * 60 * 1000);
    const second = await getAccessToken();

    expect(second).toBe('t2');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws and does NOT cache when the token response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    await expect(getAccessToken()).rejects.toThrow(/token exchange failed/i);

    // A subsequent successful call must re-attempt the fetch (nothing bad cached).
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 't1', expires_in: 86399 }),
    });
    const token = await getAccessToken();
    expect(token).toBe('t1');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a clean error at call time (not at require) when env vars are missing', async () => {
    jest.resetModules();
    delete process.env.SHOPIFY_CLIENT_ID;
    // eslint-disable-next-line global-require
    const mod = require('../services/shopifyTokenCache');
    mod._resetCache();
    await expect(mod.getAccessToken()).rejects.toThrow(/SHOPIFY_CLIENT_ID|not configured/i);
  });
});

describe('shopifyClient.shopifyRequest (authenticated GraphQL wrapper)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.SHOPIFY_SHOP_DOMAIN = 'test-shop.myshopify.com';
    process.env.SHOPIFY_API_VERSION = '2026-07';
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.resetModules();
  });

  it('does NOT throw at require() time with env unset (boot-safe)', () => {
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    jest.doMock('@shopify/admin-api-client', () => ({ createAdminApiClient: jest.fn() }));
    jest.doMock('../services/shopifyTokenCache', () => ({ getAccessToken: jest.fn() }));
    // eslint-disable-next-line global-require
    expect(() => require('../services/shopifyClient')).not.toThrow();
  });

  it('fetches a token, builds the client with it, and returns data on success', async () => {
    const mockRequest = jest.fn().mockResolvedValue({ data: { product: { id: 'gid://1' } } });
    const mockCreate = jest.fn().mockReturnValue({ request: mockRequest });
    const mockGetToken = jest.fn().mockResolvedValue('tok-abc');
    jest.doMock('@shopify/admin-api-client', () => ({ createAdminApiClient: mockCreate }));
    jest.doMock('../services/shopifyTokenCache', () => ({ getAccessToken: mockGetToken }));
    // eslint-disable-next-line global-require
    const { shopifyRequest } = require('../services/shopifyClient');

    const data = await shopifyRequest('query { x }', { a: 1 });

    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        storeDomain: 'test-shop.myshopify.com',
        apiVersion: '2026-07',
        accessToken: 'tok-abc',
      }),
    );
    expect(mockRequest).toHaveBeenCalledWith('query { x }', { variables: { a: 1 } });
    expect(data).toEqual({ product: { id: 'gid://1' } });
  });

  it('throws (surfacing userErrors/errors) when the GraphQL response has errors', async () => {
    const mockRequest = jest.fn().mockResolvedValue({ errors: { message: 'Throttled' } });
    jest.doMock('@shopify/admin-api-client', () => ({
      createAdminApiClient: jest.fn().mockReturnValue({ request: mockRequest }),
    }));
    jest.doMock('../services/shopifyTokenCache', () => ({ getAccessToken: jest.fn().mockResolvedValue('tok') }));
    // eslint-disable-next-line global-require
    const { shopifyRequest } = require('../services/shopifyClient');

    await expect(shopifyRequest('mutation { y }')).rejects.toThrow(/Shopify GraphQL error/);
  });
});
