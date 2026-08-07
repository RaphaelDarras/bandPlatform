import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Component as Stock } from './Stock'
import type { StockData } from '../lib/inventory'

// The real AuthExpiredError class is preserved via importOriginal so
// `instanceof` checks in the component keep working while loginAdmin,
// fetchStock, deactivateProduct and restoreProduct are spies (matches the
// convention already used by AddVariantPanel.test.tsx / CreateProductPanel.test.tsx).
vi.mock('../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loginAdmin: vi.fn(),
  fetchStock: vi.fn(),
  deactivateProduct: vi.fn(),
  restoreProduct: vi.fn(),
}))

import { loginAdmin, fetchStock, deactivateProduct, restoreProduct, AuthExpiredError } from '../lib/inventory'

// D-33: vite-react-ssg's <Head> renders react-helmet-async's <Helmet>, which
// requires a <HelmetProvider> ancestor (normally supplied by ViteReactSSG()
// in main.tsx). Rendering <Stock /> standalone in RTL has no such provider,
// so Head is stubbed to render its children in place — the noindex <meta>
// tag is then asserted directly in the rendered tree instead of via
// document.head plumbing.
vi.mock('vite-react-ssg', () => ({
  Head: (props: { children?: React.ReactNode }) => <>{props.children}</>,
}))

const mockStockData: StockData = {
  grandTotal: 17,
  productCount: 2,
  products: [
    {
      productId: 'prod-1',
      name: 'T-Shirt',
      category: 'Apparel',
      active: true,
      productTotal: 12,
      variants: [
        { sku: 'TS-S-BLK', size: 'S', color: 'Black', stock: 0 },
        { sku: 'TS-M-BLK', size: 'M', color: 'Black', stock: 3 },
        { sku: 'TS-L-BLK', size: 'L', color: 'Black', stock: 9 },
      ],
    },
    {
      productId: 'prod-2',
      name: 'Hoodie',
      category: 'Apparel',
      active: false,
      productTotal: 5,
      variants: [{ sku: 'HD-M-BLK', size: 'M', color: 'Black', stock: 5 }],
    },
  ],
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(loginAdmin).mockReset()
  vi.mocked(fetchStock).mockReset()
  vi.mocked(deactivateProduct).mockReset()
  vi.mocked(restoreProduct).mockReset()

  // jsdom does not implement HTMLDialogElement.prototype.showModal/close
  // (same shim as DeactivateDialog.test.tsx).
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('Stock page', () => {
  it('shows the login form when no token is stored', () => {
    render(<Stock />)

    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^stock$/i })).not.toBeInTheDocument()
  })

  it('logs in, writes the token to sessionStorage, and renders product rows', async () => {
    vi.mocked(loginAdmin).mockResolvedValueOnce({ token: 'fake-token' })
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('TS-M-BLK')).toBeInTheDocument()
    })

    expect(sessionStorage.getItem('token')).toBe('fake-token')
    expect(loginAdmin).toHaveBeenCalledWith('admin', 'secret')
    expect(fetchStock).toHaveBeenCalledWith('fake-token', true)
  })

  it('skips the login form and loads stock when a token is already in sessionStorage', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    await waitFor(() => {
      expect(screen.getByText('TS-M-BLK')).toBeInTheDocument()
    })

    expect(screen.queryByPlaceholderText(/username/i)).not.toBeInTheDocument()
    expect(fetchStock).toHaveBeenCalledWith('existing-token', true)
  })

  it('colours a 0-stock variant differently from a healthy one via stockColorClass', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    await waitFor(() => expect(screen.getByText('TS-M-BLK')).toBeInTheDocument())

    const zeroStockCell = screen.getByText('0')
    const healthyStockCell = screen.getByText('9')
    expect(zeroStockCell.className).not.toBe(healthyStockCell.className)
  })

  it('D-21: gives the 0-stock row no muting and keeps document order intact', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    await waitFor(() => expect(screen.getByText('TS-M-BLK')).toBeInTheDocument())

    const zeroStockCell = screen.getByText('0')
    expect(zeroStockCell.className).not.toMatch(/opacity/)
    expect(zeroStockCell.className).not.toMatch(/text-white\/40/)

    const skus = screen.getAllByText(/^TS-/).map((el) => el.textContent)
    expect(skus).toEqual(['TS-S-BLK', 'TS-M-BLK', 'TS-L-BLK'])
  })

  it('D-25/D-26: toggling to Archived swaps the visible product and hides editable controls', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expect(screen.queryByText('Hoodie')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))

    expect(screen.getByText('Hoodie')).toBeInTheDocument()
    expect(screen.queryByText('T-Shirt')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Set stock for/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save all/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('T-Shirt')).toBeInTheDocument()
    expect(screen.queryByText('Hoodie')).not.toBeInTheDocument()
  })

  it('D-22/D-23: Deactivate opens the confirmation dialog with the stock warning, and DELETE fires only from its confirm', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate T-Shirt' }))
    expect(deactivateProduct).not.toHaveBeenCalled()
    expect(screen.getByText('Deactivate T-Shirt?')).toBeInTheDocument()
    expect(screen.getByText('This product still has 12 units in stock.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }))
    expect(deactivateProduct).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate T-Shirt' }))
    vi.mocked(deactivateProduct).mockResolvedValueOnce(undefined)
    vi.mocked(fetchStock).mockResolvedValueOnce({
      ...mockStockData,
      products: mockStockData.products.map((p) =>
        p.productId === 'prod-1' ? { ...p, active: false } : p,
      ),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate', hidden: true }))

    await waitFor(() => {
      expect(deactivateProduct).toHaveBeenCalledTimes(1)
      expect(deactivateProduct).toHaveBeenCalledWith('existing-token', 'prod-1')
    })
  })

  it('D-27: Restore in the Archived view calls restoreProduct with no confirmation dialog', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.getByText('Hoodie')).toBeInTheDocument()
    expect(screen.queryByText(/Deactivate .*\?/)).not.toBeInTheDocument()

    vi.mocked(restoreProduct).mockResolvedValueOnce(undefined)
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    fireEvent.click(screen.getByRole('button', { name: 'Restore Hoodie' }))

    await waitFor(() => {
      expect(restoreProduct).toHaveBeenCalledTimes(1)
      expect(restoreProduct).toHaveBeenCalledWith('existing-token', 'prod-2')
    })
    expect(screen.queryByText(/Deactivate .*\?/)).not.toBeInTheDocument()
  })

  it('D-30: an AuthExpiredError from fetchStock clears the token and drops back to login with no recovery UI', async () => {
    sessionStorage.setItem('token', 'stale-token')
    vi.mocked(fetchStock).mockRejectedValueOnce(new AuthExpiredError('Session expired'))

    render(<Stock />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
    })

    expect(sessionStorage.getItem('token')).toBeNull()
    expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument()
  })

  it('D-33: emits a noindex robots meta tag', () => {
    render(<Stock />)

    const meta = document.querySelector('meta[name="robots"]')
    expect(meta).not.toBeNull()
    expect(meta).toHaveAttribute('content', 'noindex')
  })
})
