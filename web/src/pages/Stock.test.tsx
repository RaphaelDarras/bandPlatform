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
  batchAdjustStock: vi.fn(),
  putProductVariants: vi.fn(),
  createProduct: vi.fn(),
}))

import {
  loginAdmin,
  fetchStock,
  deactivateProduct,
  restoreProduct,
  batchAdjustStock,
  putProductVariants,
  createProduct,
  AuthExpiredError,
} from '../lib/inventory'

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
  vi.mocked(batchAdjustStock).mockReset()
  vi.mocked(putProductVariants).mockReset()
  vi.mocked(createProduct).mockReset()

  // jsdom does not implement HTMLDialogElement.prototype.showModal/close
  // (same shim as DeactivateDialog.test.tsx).
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

// Products render collapsed (closed) by default; click a product's header row
// to reveal its variant table / add-variant panel before asserting inner rows.
function expandProduct(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Toggle variants for ${name}` }))
}

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

    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')
    expect(screen.getByText('TS-M-BLK')).toBeInTheDocument()

    expect(sessionStorage.getItem('token')).toBe('fake-token')
    expect(loginAdmin).toHaveBeenCalledWith('admin', 'secret')
    expect(fetchStock).toHaveBeenCalledWith('fake-token', true)
  })

  it('renders products collapsed by default with the name, units and Deactivate visible, and toggles open/closed on click', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())

    // Closed by default: the header line (name + units + Deactivate) shows,
    // but the variant rows underneath do not.
    expect(screen.getByText('12 units')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivate T-Shirt' })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle variants for T-Shirt' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('TS-M-BLK')).not.toBeInTheDocument()

    // Click opens it.
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('TS-M-BLK')).toBeInTheDocument()

    // Click again closes it.
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('TS-M-BLK')).not.toBeInTheDocument()
  })

  it('skips the login form and loads stock when a token is already in sessionStorage', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')
    expect(screen.getByText('TS-M-BLK')).toBeInTheDocument()

    expect(screen.queryByPlaceholderText(/username/i)).not.toBeInTheDocument()
    expect(fetchStock).toHaveBeenCalledWith('existing-token', true)
  })

  it('colours a 0-stock variant differently from a healthy one via stockColorClass', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    const zeroStockCell = screen.getByText('0')
    const healthyStockCell = screen.getByText('9')
    expect(zeroStockCell.className).not.toBe(healthyStockCell.className)
  })

  it('D-21: gives the 0-stock row no muting and keeps document order intact', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)

    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

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

  it('D-01/D-05: the footer dirty count grows per dirty row and Save all starts disabled', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    const saveButton = screen.getByRole('button', { name: /save all/i })
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveTextContent('Save all')

    fireEvent.click(screen.getByRole('button', { name: 'Increase stock for TS-M-BLK' }))
    expect(screen.getByRole('button', { name: /save all changes \(1\)/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Increase stock for TS-S-BLK' }))
    expect(screen.getByRole('button', { name: /save all changes \(2\)/i })).toBeEnabled()
  })

  it('D-06 (companion): the "(was N)" caption appears on a dirty row and clears on Discard changes', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: 'Increase stock for TS-M-BLK' }))
    expect(screen.getByText('(was 3)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }))
    expect(screen.queryByText('(was 3)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save all$/i })).toBeDisabled()
  })

  it('D-03: sends the delta (pending - displayed), not the absolute value, with no submit-time re-read', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(batchAdjustStock).mockResolvedValueOnce({ success: true, results: [] })

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.change(screen.getByLabelText(/^Set stock for T-Shirt, M \/ Black \(TS-M-BLK\)/), {
      target: { value: '10' },
    })

    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    fireEvent.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    expect(batchAdjustStock).toHaveBeenCalledTimes(1)
    expect(batchAdjustStock).toHaveBeenCalledWith('existing-token', [
      { productId: 'prod-1', variantSku: 'TS-M-BLK', quantity: 7 },
    ])
    // No submit-time re-read (D-03): fetchStock has not been called again yet.
    expect(fetchStock).toHaveBeenCalledTimes(1)

    await waitFor(() => expect(fetchStock).toHaveBeenCalledTimes(2))
  })

  it('D-07: three decrements from server stock 2 send quantity: -3, going below zero', async () => {
    const twoStockData: StockData = {
      ...mockStockData,
      products: mockStockData.products.map((p) =>
        p.productId === 'prod-1'
          ? { ...p, variants: p.variants.map((v) => (v.sku === 'TS-M-BLK' ? { ...v, stock: 2 } : v)) }
          : p,
      ),
    }
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(twoStockData)
    vi.mocked(batchAdjustStock).mockResolvedValueOnce({ success: true, results: [] })

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    const decreaseButton = screen.getByRole('button', { name: 'Decrease stock for TS-M-BLK' })
    fireEvent.click(decreaseButton)
    fireEvent.click(decreaseButton)
    fireEvent.click(decreaseButton)

    vi.mocked(fetchStock).mockResolvedValueOnce(twoStockData)
    fireEvent.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    expect(batchAdjustStock).toHaveBeenCalledWith('existing-token', [
      { productId: 'prod-1', variantSku: 'TS-M-BLK', quantity: -3 },
    ])
  })

  it('D-06: an all-or-nothing batch failure preserves the typed value, the dirty count, and shows "nothing was saved"', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(batchAdjustStock).mockRejectedValueOnce(
      new Error('Product or variant not found: TS-M-BLK'),
    )

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.change(screen.getByLabelText(/^Set stock for T-Shirt, M \/ Black \(TS-M-BLK\)/), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('nothing was saved')
      expect(alert).toHaveTextContent('Product or variant not found: TS-M-BLK')
      expect(alert).toHaveTextContent('Your changes are still here.')
    })

    expect(screen.getByLabelText(/^Set stock for T-Shirt, M \/ Black \(TS-M-BLK\)/)).toHaveValue(10)
    expect(screen.getByRole('button', { name: /save all changes \(1\)/i })).toBeInTheDocument()
  })

  it('on success, pending clears and the footer returns to the disabled idle state', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(batchAdjustStock).mockResolvedValueOnce({ success: true, results: [] })

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: 'Increase stock for TS-M-BLK' }))
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    fireEvent.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^save all$/i })).toBeDisabled()
    })
    expect(fetchStock).toHaveBeenCalledTimes(2)
  })

  it('D-30: an AuthExpiredError from batchAdjustStock clears the token and shows no unsaved-changes prompt', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(batchAdjustStock).mockRejectedValueOnce(new AuthExpiredError('Session expired'))

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: 'Increase stock for TS-M-BLK' }))
    fireEvent.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
    })
    expect(sessionStorage.getItem('token')).toBeNull()
    expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument()
  })

  it('D-04: no control or text anywhere in the Active view names or mentions "reason"', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    expect(screen.queryByLabelText(/reason/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/reason/i)).not.toBeInTheDocument()
  })

  it('D-20: editing a Size input on blur sends the full variant array via putProductVariants without touching dirtyCount', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(putProductVariants).mockResolvedValueOnce({})

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    expect(screen.getByRole('button', { name: /^save all$/i })).toBeDisabled()

    const sizeInput = screen.getByLabelText('Size for T-Shirt (TS-M-BLK)')
    fireEvent.change(sizeInput, { target: { value: 'ML' } })
    // No stock edits are pending, so a successful label save re-runs
    // loadStock (queue the refresh response before triggering the blur).
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    fireEvent.blur(sizeInput)

    await waitFor(() => expect(putProductVariants).toHaveBeenCalledTimes(1))
    const [, , variantsArg] = vi.mocked(putProductVariants).mock.calls[0]
    expect(variantsArg).toHaveLength(3)
    expect(variantsArg).toContainEqual(expect.objectContaining({ sku: 'TS-M-BLK', size: 'ML' }))

    await waitFor(() => expect(fetchStock).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: /^save all$/i })).toBeDisabled()
    expect(screen.queryByLabelText(/price adjustment/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/price adjustment/i)).not.toBeInTheDocument()
  })

  it('a putProductVariants rejection shows the row-scoped label error, not the batch banner', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(putProductVariants).mockRejectedValueOnce(new Error('Update failed'))

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    const colorInput = screen.getByLabelText('Color for T-Shirt (TS-M-BLK)')
    fireEvent.change(colorInput, { target: { value: 'Navy' } })
    fireEvent.blur(colorInput)

    await waitFor(() => {
      expect(screen.getByText("Couldn't save this change — try again.")).toBeInTheDocument()
    })
    expect(screen.queryByText(/nothing was saved/i)).not.toBeInTheDocument()
  })

  it('D-26: the Archived view has no sticky footer, no stock-set controls, and no size inputs', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))

    expect(screen.queryByRole('button', { name: /save all/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Set stock for/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Size for/)).not.toBeInTheDocument()
  })

  it('+ Add product reveals the create panel and toggles its own label to Cancel', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    expect(screen.queryByText('New Product')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add product' }))
    expect(screen.getByText('New Product')).toBeInTheDocument()
    // The trigger's own label became "Cancel"; the panel also has its own
    // Cancel button, so two "Cancel" buttons now exist -- the trigger is the
    // first in document order.
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    expect(cancelButtons).toHaveLength(2)

    fireEvent.click(cancelButtons[0])
    expect(screen.queryByText('New Product')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add product' })).toBeInTheDocument()
  })

  it('INV-05: creating a product through the page adds it to the Active list without a reload', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(createProduct).mockResolvedValueOnce({})

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: '+ Add product' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Cap' } })
    fireEvent.change(screen.getByLabelText(/base price/i), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'One Size' } })

    const newStockData: StockData = {
      ...mockStockData,
      products: [
        ...mockStockData.products,
        {
          productId: 'prod-3',
          name: 'Cap',
          category: null,
          active: true,
          productTotal: 0,
          variants: [{ sku: 'CAP-ONES', size: 'One Size', color: null, stock: 0 }],
        },
      ],
    }
    vi.mocked(fetchStock).mockResolvedValueOnce(newStockData)

    fireEvent.click(screen.getByRole('button', { name: 'Create product' }))

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(fetchStock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('Cap')).toBeInTheDocument())
    expect(screen.queryByText('New Product')).not.toBeInTheDocument()
  })

  it('+ Add variant is scoped to one product and moves rather than opening two', async () => {
    sessionStorage.setItem('token', 'existing-token')
    const twoActiveStockData: StockData = {
      ...mockStockData,
      products: mockStockData.products.map((p) => ({ ...p, active: true })),
    }
    vi.mocked(fetchStock).mockResolvedValueOnce(twoActiveStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expect(screen.getByText('Hoodie')).toBeInTheDocument()
    expandProduct('T-Shirt')
    expandProduct('Hoodie')

    fireEvent.click(screen.getByRole('button', { name: 'Add variant to T-Shirt' }))
    expect(screen.getAllByText('Add Variant')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Add variant to Hoodie' }))
    expect(screen.getAllByText('Add Variant')).toHaveLength(1)
  })

  it('INV-07: adding a variant calls putProductVariants then batchAdjustStock, refetches, and closes the panel', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(putProductVariants).mockResolvedValueOnce({})
    vi.mocked(batchAdjustStock).mockResolvedValueOnce({ success: true, results: [] })

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: 'Add variant to T-Shirt' }))
    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'XL' } })
    fireEvent.change(screen.getByLabelText(/^Opening stock/), { target: { value: '4' } })

    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    fireEvent.click(screen.getByRole('button', { name: 'Add variant(s)' }))

    await waitFor(() => expect(putProductVariants).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(batchAdjustStock).toHaveBeenCalledWith('existing-token', [
        { productId: 'prod-1', variantSku: 'TSHIRT-XL', quantity: 4 },
      ]),
    )
    await waitFor(() => expect(fetchStock).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Add Variant')).not.toBeInTheDocument()
  })

  it('D-18: a failed follow-up stock write leaves a pre-dirty row with the exact SKU-specific warning, recoverable via Save all', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)
    vi.mocked(putProductVariants).mockResolvedValueOnce({})
    vi.mocked(batchAdjustStock).mockRejectedValueOnce(new Error('Batch save failed'))

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: 'Add variant to T-Shirt' }))
    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'XL' } })
    fireEvent.change(screen.getByLabelText(/^Opening stock/), { target: { value: '4' } })

    const stockWithNewVariant: StockData = {
      ...mockStockData,
      products: mockStockData.products.map((p) =>
        p.productId === 'prod-1'
          ? { ...p, variants: [...p.variants, { sku: 'TSHIRT-XL', size: 'XL', color: null, stock: 0 }] }
          : p,
      ),
    }
    vi.mocked(fetchStock).mockResolvedValueOnce(stockWithNewVariant)

    fireEvent.click(screen.getByRole('button', { name: 'Add variant(s)' }))

    await waitFor(() => expect(fetchStock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Add Variant')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('TSHIRT-XL')).toBeInTheDocument())

    const newRowInput = await screen.findByLabelText(/^Set stock for T-Shirt, XL \/ — \(TSHIRT-XL\)/)
    expect(newRowInput).toHaveValue(4)

    expect(
      screen.getByText(
        "Variant TSHIRT-XL was created at 0 — its starting quantity wasn't saved. Enter the correct count below and save.",
      ),
    ).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /save all changes \(1\)/i })).toBeInTheDocument()
    expect(screen.queryByText(/nothing was saved/i)).not.toBeInTheDocument()

    vi.mocked(batchAdjustStock).mockResolvedValueOnce({ success: true, results: [] })
    vi.mocked(fetchStock).mockResolvedValueOnce(stockWithNewVariant)
    fireEvent.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    await waitFor(() =>
      expect(batchAdjustStock).toHaveBeenCalledWith('existing-token', [
        { productId: 'prod-1', variantSku: 'TSHIRT-XL', quantity: 4 },
      ]),
    )

    await waitFor(() => expect(screen.queryByText(/was created at 0/)).not.toBeInTheDocument())
  })

  it('D-10: with the create panel closed, no control anywhere edits a saved product\'s content', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/base price/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/image/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit product/i })).not.toBeInTheDocument()
  })

  it('D-16: with panels closed, no control removes a saved variant', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    expect(screen.queryByRole('button', { name: /remove.*variant/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /from preview/ })).not.toBeInTheDocument()
  })

  it('D-19: both the create panel and the add-variant panel expose a Sizes control from the shared generator', async () => {
    sessionStorage.setItem('token', 'existing-token')
    vi.mocked(fetchStock).mockResolvedValueOnce(mockStockData)

    render(<Stock />)
    await waitFor(() => expect(screen.getByText('T-Shirt')).toBeInTheDocument())
    expandProduct('T-Shirt')

    fireEvent.click(screen.getByRole('button', { name: '+ Add product' }))
    expect(screen.getByLabelText(/^sizes$/i)).toBeInTheDocument()
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButtons[0])

    fireEvent.click(screen.getByRole('button', { name: 'Add variant to T-Shirt' }))
    expect(screen.getByLabelText(/^sizes$/i)).toBeInTheDocument()
  })
})
