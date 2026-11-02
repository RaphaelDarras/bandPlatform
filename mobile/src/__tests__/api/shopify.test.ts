import {
  getAccessToken,
  _resetTokenCache,
  gql,
  fetchCatalogue,
  readVariantLevel,
  adjustAvailable,
  ShopifyError,
  _setSleepForTests,
} from '../../api/shopify';

const SECRET = 'super-secret-value';
const LOC = 'gid://shopify/Location/1';

function res(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}
const tokenRes = (expires = 86399, token = 'tok') =>
  res(200, { access_token: token, expires_in: expires });

let fetchMock: jest.Mock;
let sleepMock: jest.Mock;

beforeEach(() => {
  process.env.EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN = 'shop.myshopify.com';
  process.env.EXPO_PUBLIC_SHOPIFY_CLIENT_ID = 'cid';
  process.env.EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET = SECRET;
  process.env.EXPO_PUBLIC_SHOPIFY_LOCATION_ID = LOC;
  delete process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION;
  _resetTokenCache();
  fetchMock = jest.fn();
  sleepMock = jest.fn(() => Promise.resolve());
  _setSleepForTests(sleepMock);
  (globalThis as any).fetch = fetchMock;
});

describe('getAccessToken', () => {
  it('posts a client_credentials form body', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes());
    await expect(getAccessToken()).resolves.toBe('tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://shop.myshopify.com/admin/oauth/access_token');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(typeof init.body).toBe('string');
    expect(init.body).toContain('grant_type=client_credentials');
    expect(init.body).toContain('client_id=cid');
    expect(init.body).toContain('client_secret=' + SECRET);
  });

  it('caches within validity window', async () => {
    fetchMock.mockResolvedValue(tokenRes());
    await getAccessToken();
    await getAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('force re-exchanges', async () => {
    fetchMock.mockResolvedValue(tokenRes());
    await getAccessToken();
    await getAccessToken(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes when within 5 minutes of expiry', async () => {
    fetchMock.mockResolvedValue(tokenRes(200));
    await getAccessToken();
    await getAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws http error without leaking secret', async () => {
    fetchMock.mockResolvedValueOnce(res(403));
    const err = await getAccessToken().catch((e: any) => e);
    expect(err).toBeInstanceOf(ShopifyError);
    expect(err.kind).toBe('http');
    expect(err.status).toBe(403);
    expect(err.message).not.toContain(SECRET);
  });

  it('throws config error when env missing', async () => {
    delete process.env.EXPO_PUBLIC_SHOPIFY_LOCATION_ID;
    const err = await getAccessToken().catch((e: any) => e);
    expect(err.kind).toBe('config');
    expect(err.retryable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('gql', () => {
  it('sends authenticated JSON request', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(res(200, { data: { a: 1 } }));
    await expect(gql('query { a }', { x: 1 })).resolves.toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://shop.myshopify.com/admin/api/2026-07/graphql.json');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Shopify-Access-Token']).toBe('tok');
    expect(JSON.parse(init.body)).toEqual({ query: 'query { a }', variables: { x: 1 } });
  });

  it('retries once on 401 with a fresh token', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes(86399, 't1'))
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(tokenRes(86399, 't2'))
      .mockResolvedValueOnce(res(200, { data: { ok: true } }));
    await expect(gql('q', {})).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1].headers['X-Shopify-Access-Token']).toBe('t2');
  });

  it('does not retry a second 401 forever', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(401));
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.kind).toBe('http');
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([429, 503])('marks %i retryable', async (status) => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(res(status));
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.retryable).toBe(true);
  });

  it('marks 400 non-retryable', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(res(400));
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.retryable).toBe(false);
  });

  it('THROTTLED graphql error is retryable once gql gives up waiting', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValue(res(200, { errors: [{ extensions: { code: 'THROTTLED' } }] }));
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.kind).toBe('graphql');
    expect(err.retryable).toBe(true);
    expect(sleepMock).toHaveBeenCalledTimes(3); // MAX_THROTTLE_RETRIES
  });

  it('waits out THROTTLED using extensions.cost and then succeeds (WR-04)', async () => {
    const throttled = res(200, {
      errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
      extensions: {
        cost: { requestedQueryCost: 300, throttleStatus: { currentlyAvailable: 100, restoreRate: 100 } },
      },
    });
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(throttled)
      .mockResolvedValueOnce(res(200, { data: { ok: 1 } }));
    await expect(gql<any>('q', {})).resolves.toEqual({ ok: 1 });
    expect(sleepMock).toHaveBeenCalledWith(2000); // (300 - 100) / 100 s
  });

  it('MAX_COST_EXCEEDED is retried with backoff too', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(200, { errors: [{ extensions: { code: 'MAX_COST_EXCEEDED' } }] }))
      .mockResolvedValueOnce(res(200, { data: { ok: 2 } }));
    await expect(gql<any>('q', {})).resolves.toEqual({ ok: 2 });
    expect(sleepMock).toHaveBeenCalledWith(1000);
  });

  it('does not wait on non-throttle GraphQL errors', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(200, { errors: [{ message: 'bad' }] }));
    await gql<any>('q', {}).catch(() => undefined);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('other graphql errors are not retryable', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(200, { errors: [{ message: 'bad' }] }));
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.kind).toBe('graphql');
    expect(err.retryable).toBe(false);
  });

  it('exposes top-level extensions codes (WR-03)', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      res(200, {
        errors: [{ message: 'mismatch', extensions: { code: 'IDEMPOTENCY_KEY_PARAMETER_MISMATCH' } }],
      })
    );
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.codes).toEqual(['IDEMPOTENCY_KEY_PARAMETER_MISMATCH']);
    expect(err.retryable).toBe(false);
  });

  it('network failure is retryable', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockRejectedValueOnce(new Error('offline'));
    const err = await gql<any>('q', {}).catch((e: any) => e);
    expect(err.kind).toBe('network');
    expect(err.retryable).toBe(true);
  });
});

function product(id: string, variants: any[], image?: string) {
  return {
    id,
    title: 'T-' + id,
    featuredMedia: image ? { preview: { image: { url: image } } } : null,
    variants: { nodes: variants },
  };
}
function variant(id: string, opts: any[], extra: any = {}) {
  return {
    id,
    title: 'v',
    sku: 'S',
    price: '25.00',
    selectedOptions: opts,
    inventoryItem: {
      id: 'inv-' + id,
      inventoryLevel: { quantities: [{ name: 'available', quantity: 4 }] },
    },
    ...extra,
  };
}

describe('fetchCatalogue', () => {
  it('pages through all products and maps fields', async () => {
    const page1 = {
      data: {
        products: {
          pageInfo: { hasNextPage: true, endCursor: 'c1' },
          nodes: [
            product('p1', [variant('v1', [{ name: 'Title', value: 'Default Title' }])], 'http://img'),
          ],
        },
      },
    };
    const page2 = {
      data: {
        products: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            product('p2', [
              variant('v2', [
                { name: 'Size', value: 'M' },
                { name: 'Color', value: 'Black' },
              ]),
              variant('v3', [{ name: 'Title', value: 'Default Title' }], {
                sku: null,
                inventoryItem: { id: 'inv-v3', inventoryLevel: null },
              }),
            ]),
          ],
        },
      },
    };
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(200, page1))
      .mockResolvedValueOnce(res(200, page2));
    const out = await fetchCatalogue();
    const body1 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body1.query).toContain('status:active');
    expect(body1.variables).toEqual({ after: null, loc: LOC });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).variables.after).toBe('c1');
    expect(out.map((p) => p.productGid)).toEqual(['p1', 'p2']);
    expect(out[0].imageUrl).toBe('http://img');
    expect(out[0].variants[0]).toEqual({
      variantGid: 'v1',
      sku: 'S',
      label: '',
      price: 25,
      available: 4,
    });
    expect(out[1].imageUrl).toBeNull();
    expect(out[1].variants[0].label).toBe('M / Black');
    expect(out[1].variants[1].sku).toBe('');
    expect(out[1].variants[1].available).toBe(0);
  });

  it('pages variants beyond the first page (WR-04)', async () => {
    const first = product('p1', [variant('v1', [{ name: 'Size', value: 'S' }])]);
    (first.variants as any).pageInfo = { hasNextPage: true, endCursor: 'vc1' };
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(
        res(200, { data: { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [first] } } }),
      )
      .mockResolvedValueOnce(
        res(200, {
          data: {
            product: {
              variants: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [variant('v2', [{ name: 'Size', value: 'M' }])],
              },
            },
          },
        }),
      );
    const out = await fetchCatalogue();
    expect(out[0].variants.map((v) => v.variantGid)).toEqual(['v1', 'v2']);
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.variables).toEqual({ id: 'p1', after: 'vc1', loc: LOC });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).query).toContain('products(first: 25');
  });

  it('throws when a later page fails', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(
        res(200, {
          data: {
            products: { pageInfo: { hasNextPage: true, endCursor: 'c1' }, nodes: [] },
          },
        }),
      )
      .mockResolvedValueOnce(res(500));
    await expect(fetchCatalogue()).rejects.toBeInstanceOf(ShopifyError);
  });
});

describe('readVariantLevel', () => {
  it('returns null when variant deleted', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(res(200, { data: { productVariant: null } }));
    await expect(readVariantLevel('gid://v')).resolves.toBeNull();
  });

  it('returns item id and available', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      res(200, {
        data: {
          productVariant: {
            inventoryItem: {
              id: 'inv1',
              inventoryLevel: { quantities: [{ name: 'available', quantity: 7 }] },
            },
          },
        },
      }),
    );
    await expect(readVariantLevel('gid://v')).resolves.toEqual({
      inventoryItemId: 'inv1',
      available: 7,
    });
  });
});

describe('adjustAvailable', () => {
  const input = {
    inventoryItemId: 'inv1',
    delta: -2,
    changeFromQuantity: 5,
    referenceDocumentUri: 'gid://band-pos/Sale/abc',
    idempotencyKey: 'key-1',
  };

  it('sends idempotent mutation and returns applied delta', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      res(200, {
        data: {
          inventoryAdjustQuantities: {
            inventoryAdjustmentGroup: { changes: [{ name: 'available', delta: -2 }] },
            userErrors: [],
          },
        },
      }),
    );
    await expect(adjustAvailable(input)).resolves.toEqual({ ok: true, appliedDelta: -2 });
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.query).toContain('inventoryAdjustQuantities');
    expect(body.query).toContain('@idempotent(key: $key)');
    expect(body.variables.key).toBe('key-1');
    expect(body.variables.input).toEqual({
      name: 'available',
      reason: 'correction',
      referenceDocumentUri: 'gid://band-pos/Sale/abc',
      changes: [{ inventoryItemId: 'inv1', locationId: LOC, delta: -2, changeFromQuantity: 5 }],
    });
  });

  it('falls back to input delta when no change entry', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      res(200, { data: { inventoryAdjustQuantities: { userErrors: [] } } }),
    );
    await expect(adjustAvailable(input)).resolves.toEqual({ ok: true, appliedDelta: -2 });
  });

  it('returns userErrors[0]', async () => {
    fetchMock.mockResolvedValueOnce(tokenRes()).mockResolvedValueOnce(
      res(200, {
        data: {
          inventoryAdjustQuantities: {
            userErrors: [{ field: ['x'], message: 'stale', code: 'CHANGE_FROM_QUANTITY_STALE' }],
          },
        },
      }),
    );
    await expect(adjustAvailable(input)).resolves.toEqual({
      ok: false,
      code: 'CHANGE_FROM_QUANTITY_STALE',
      message: 'stale',
    });
  });
});
