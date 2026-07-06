import { describe, it, expect, vi, afterEach } from 'vitest'
import { createOrder, capturePaypalOrder } from './orders'

// Runtime fetch client tests (mirrors products.ts's fetch-in-lib pattern).
// No Authorization header on either call — both are public guest-checkout
// endpoints (D-05/D-06/D-07/D-09/D-10 conventions carried over from products.ts).

const API = 'https://hurakan-band-platform.onrender.com'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createOrder', () => {
  const payload = {
    customerEmail: 'fan@example.com',
    customerName: 'Fan Name',
    items: [{ productId: 'p1', variantSku: 'TS-M-BLK', quantity: 2 }],
    shippingAddress: {
      addressLine1: '1 Rue Example',
      city: 'Paris',
      postalCode: '75001',
      country: 'France',
    },
    paymentMethod: 'stripe' as const,
  }

  it('POSTs to /api/orders with the payload as JSON and no Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ orderNumber: 'HRK-ABC123', redirectUrl: 'https://checkout.example.com/session' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await createOrder(payload)

    expect(mockFetch).toHaveBeenCalledWith(
      `${API}/api/orders`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(result).toEqual({ orderNumber: 'HRK-ABC123', redirectUrl: 'https://checkout.example.com/session' })
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Bad request' }) }),
    )

    await expect(createOrder(payload)).rejects.toThrow()
  })

  it('surfaces the API-provided error message body instead of a generic status string (WR-05)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Insufficient stock for TS-M-BLK' }),
      }),
    )

    await expect(createOrder(payload)).rejects.toThrow('Insufficient stock for TS-M-BLK')
  })

  it('falls back to a generic message when the error body cannot be parsed', async () => {
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

    await expect(createOrder(payload)).rejects.toThrow('Failed to create order (500)')
  })
})

describe('capturePaypalOrder', () => {
  it('POSTs to /api/orders/paypal/capture with the paypalOrderId and resolves the status body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'COMPLETED' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await capturePaypalOrder('PAYPAL-ORDER-1')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API}/api/orders/paypal/capture`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalOrderId: 'PAYPAL-ORDER-1' }),
      }),
    )
    expect(result).toEqual({ status: 'COMPLETED' })
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) }),
    )

    await expect(capturePaypalOrder('PAYPAL-ORDER-1')).rejects.toThrow()
  })

  it('surfaces the API-provided error message body instead of a generic status string (WR-05)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Capture already used' }) }),
    )

    await expect(capturePaypalOrder('PAYPAL-ORDER-1')).rejects.toThrow('Capture already used')
  })
})
