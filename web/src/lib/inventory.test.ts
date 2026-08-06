import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  AuthExpiredError,
  loginAdmin,
  fetchStock,
  batchAdjustStock,
  putProductVariants,
  restoreProduct,
  deactivateProduct,
} from './inventory'

// Authenticated fetch client tests (D-30). Both 401 and 403 are tested as
// SEPARATE cases per call site — the historical mobile-app bug ([Phase
// 02-post] in STATE.md) was exactly "handled 401, forgot 403".

const API = 'https://hurakan-band-platform.onrender.com'
const TOKEN = 'test-token-123'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fetchStock', () => {
  it('rejects with AuthExpiredError on a 401 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) }),
    )

    await expect(fetchStock(TOKEN)).rejects.toBeInstanceOf(AuthExpiredError)
  })

  it('rejects with AuthExpiredError on a 403 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) }),
    )

    await expect(fetchStock(TOKEN)).rejects.toBeInstanceOf(AuthExpiredError)
  })

  it('calls fetch with includeInactive=true and a Bearer Authorization header by default', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ grandTotal: 0, productCount: 0, products: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchStock(TOKEN)

    expect(mockFetch).toHaveBeenCalledWith(
      `${API}/api/inventory/stock?includeInactive=true`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    )
  })

  it('calls fetch with no query string when includeInactive is false', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ grandTotal: 0, productCount: 0, products: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchStock(TOKEN, false)

    expect(mockFetch).toHaveBeenCalledWith(`${API}/api/inventory/stock`, expect.anything())
  })

  it('falls back to a status-code message when the error body is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json')
        },
      }),
    )

    await expect(fetchStock(TOKEN)).rejects.toThrow('500')
  })
})

describe('batchAdjustStock', () => {
  const adjustments = [{ productId: 'p1', variantSku: 'TS-M-BLK', quantity: 5 }]

  it('rejects with AuthExpiredError on a 403 response (shared wrapper, not per call site)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) }),
    )

    await expect(batchAdjustStock(TOKEN, adjustments)).rejects.toBeInstanceOf(AuthExpiredError)
  })

  it('rejects with a plain Error carrying the server message on a 409, not AuthExpiredError (D-06)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Product or variant not found: TS-M-BLK' }),
      }),
    )

    const promise = batchAdjustStock(TOKEN, adjustments)
    await expect(promise).rejects.toThrow('Product or variant not found: TS-M-BLK')
    await expect(promise).rejects.not.toBeInstanceOf(AuthExpiredError)
  })

  it('sends POST with Content-Type json and a body of { adjustments } unchanged', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, results: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await batchAdjustStock(TOKEN, adjustments)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${API}/api/inventory/restock/batch`)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }),
    )
    expect(JSON.parse(init.body)).toEqual({ adjustments })
  })
})

describe('putProductVariants', () => {
  it('sends PUT to /api/products/:id with a body whose variants array matches the input length (D-17)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const variants = [
      { sku: 'TS-M-BLK', size: 'M', color: 'Black', stock: 3 },
      { sku: 'TS-L-BLK', size: 'L', color: 'Black', stock: 1 },
    ]

    await putProductVariants(TOKEN, 'p1', variants)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${API}/api/products/p1`)
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body.variants).toHaveLength(variants.length)
    expect(body.variants).toEqual(variants)
  })
})

describe('restoreProduct', () => {
  it('sends PUT with body { active: true }', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    await restoreProduct(TOKEN, 'p1')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${API}/api/products/p1`)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ active: true })
  })
})

describe('deactivateProduct', () => {
  it('sends DELETE with no body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    await deactivateProduct(TOKEN, 'p1')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${API}/api/products/p1`)
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
  })
})

describe('loginAdmin', () => {
  it('sends no Authorization header and returns the parsed token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'abc123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await loginAdmin('admin', 'password')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API}/api/auth/login`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' }),
      }),
    )
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(result).toEqual({ token: 'abc123' })
  })

  it('rejects with a plain Error carrying the server message on a 401, not AuthExpiredError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) }),
    )

    const promise = loginAdmin('admin', 'wrong')
    await expect(promise).rejects.toThrow('Invalid credentials')
    await expect(promise).rejects.not.toBeInstanceOf(AuthExpiredError)
  })
})
