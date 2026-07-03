import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Component as Stock } from './Stock'

const mockStockData = {
  grandTotal: 12,
  productCount: 1,
  products: [
    {
      name: 'T-Shirt',
      productTotal: 12,
      variants: [
        { sku: 'TS-S-BLK', size: 'S', color: 'Black', stock: 0 },
        { sku: 'TS-M-BLK', size: 'M', color: 'Black', stock: 3 },
        { sku: 'TS-L-BLK', size: 'L', color: 'Black', stock: 9 },
      ],
    },
  ],
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Stock page', () => {
  it('shows the login form when no token is stored', () => {
    render(<Stock />)

    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^stock$/i })).not.toBeInTheDocument()
  })

  it('logs in and renders product/variant rows on success (no live network call)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'fake-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStockData,
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<Stock />)

    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('TS-M-BLK')).toBeInTheDocument()
    })

    expect(screen.getByText(/12 units across 1 products/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/inventory/stock'),
      expect.objectContaining({ headers: { Authorization: 'Bearer fake-token' } }),
    )
    expect(sessionStorage.getItem('token')).toBe('fake-token')
  })

  it('clears the token and returns to the login view on a 401 from the stock fetch', async () => {
    sessionStorage.setItem('token', 'stale-token')
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Stock />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
    })

    expect(sessionStorage.getItem('token')).toBeNull()
  })
})
