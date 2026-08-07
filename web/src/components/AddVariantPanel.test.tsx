import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AddVariantPanel } from './AddVariantPanel'
import type { StockVariant } from '../lib/inventory'

// End-to-end coverage for the add-variant panel (INV-07). The real
// AuthExpiredError class is preserved via importOriginal so `instanceof`
// checks in the component keep working while putProductVariants and
// batchAdjustStock are spies.
vi.mock('../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  putProductVariants: vi.fn(),
  batchAdjustStock: vi.fn(),
}))

import { putProductVariants, batchAdjustStock, AuthExpiredError } from '../lib/inventory'

const existingVariants: StockVariant[] = [
  { sku: 'TSHIRT-S-BLK', size: 'S', color: 'Black', stock: 10 },
  { sku: 'TSHIRT-M-BLK', size: 'M', color: 'Black', stock: 8 },
  { sku: 'TSHIRT-L-BLK', size: 'L', color: 'Black', stock: 5 },
]

function defaultProps() {
  return {
    token: 'test-token',
    productId: 'product-1',
    productName: 'T-Shirt',
    existingVariants,
    existingSkus: existingVariants.map((v) => v.sku),
    onAdded: vi.fn(),
    onPartialFailure: vi.fn(),
    onCancel: vi.fn(),
    onAuthExpired: vi.fn(),
  }
}

function generateXlRow(stock: string) {
  fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'XL' } })
  fireEvent.change(screen.getByLabelText('Opening stock for XL / —'), { target: { value: stock } })
}

beforeEach(() => {
  vi.mocked(putProductVariants).mockReset()
  vi.mocked(batchAdjustStock).mockReset()
})

describe('AddVariantPanel', () => {
  it('D-17: sends the full existing-plus-new variant array, never a shrunken one', async () => {
    vi.mocked(putProductVariants).mockResolvedValue({})
    vi.mocked(batchAdjustStock).mockResolvedValue({ success: true, results: [] })
    render(<AddVariantPanel {...defaultProps()} />)

    generateXlRow('4')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    expect(putProductVariants).toHaveBeenCalledTimes(1)
    const [, , sentVariants] = vi.mocked(putProductVariants).mock.calls[0]
    expect(sentVariants).toHaveLength(existingVariants.length + 1)
    for (const existing of existingVariants) {
      expect(sentVariants.some((v) => v.sku === existing.sku)).toBe(true)
    }
    expect(sentVariants.length).toBeGreaterThanOrEqual(existingVariants.length)
  })

  it('happy chain: calls batchAdjustStock with the intended opening count, then onAdded, never onPartialFailure', async () => {
    vi.mocked(putProductVariants).mockResolvedValue({})
    vi.mocked(batchAdjustStock).mockResolvedValue({ success: true, results: [] })
    const onAdded = vi.fn()
    const onPartialFailure = vi.fn()
    render(<AddVariantPanel {...defaultProps()} onAdded={onAdded} onPartialFailure={onPartialFailure} />)

    generateXlRow('4')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    expect(batchAdjustStock).toHaveBeenCalledTimes(1)
    expect(batchAdjustStock).toHaveBeenCalledWith('test-token', [
      { productId: 'product-1', variantSku: 'TSHIRT-XL', quantity: 4 },
    ])
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onPartialFailure).not.toHaveBeenCalled()
  })

  it('no-quantity shortcut: skips batchAdjustStock entirely when opening stock is left at 0, still calls onAdded', async () => {
    vi.mocked(putProductVariants).mockResolvedValue({})
    const onAdded = vi.fn()
    render(<AddVariantPanel {...defaultProps()} onAdded={onAdded} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'XL' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    expect(batchAdjustStock).not.toHaveBeenCalled()
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  it('first write fails: renders the exact server message in role="alert", never calls batchAdjustStock, onAdded, or onPartialFailure', async () => {
    vi.mocked(putProductVariants).mockRejectedValue(new Error('SKU already in use: TSHIRT-XL'))
    const onAdded = vi.fn()
    const onPartialFailure = vi.fn()
    render(<AddVariantPanel {...defaultProps()} onAdded={onAdded} onPartialFailure={onPartialFailure} />)

    generateXlRow('4')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('SKU already in use: TSHIRT-XL')
    expect(batchAdjustStock).not.toHaveBeenCalled()
    expect(onAdded).not.toHaveBeenCalled()
    expect(onPartialFailure).not.toHaveBeenCalled()
    // The row must survive the failure so the admin doesn't have to re-type it.
    expect(screen.getByLabelText('Opening stock for XL / —')).toHaveValue(4)
  })

  it('D-18: on a second-write failure, hands back the intended count (not 0) and the server message, and renders no generic error text', async () => {
    vi.mocked(putProductVariants).mockResolvedValue({})
    vi.mocked(batchAdjustStock).mockRejectedValue(new Error('Batch save failed'))
    const onAdded = vi.fn()
    const onPartialFailure = vi.fn()
    render(<AddVariantPanel {...defaultProps()} onAdded={onAdded} onPartialFailure={onPartialFailure} />)

    generateXlRow('4')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    expect(onPartialFailure).toHaveBeenCalledTimes(1)
    const [seeds, message] = vi.mocked(onPartialFailure).mock.calls[0]
    expect(seeds).toEqual(
      expect.arrayContaining([{ sku: 'TSHIRT-XL', size: 'XL', color: null, intendedStock: 4 }]),
    )
    expect(message).toBe('Batch save failed')
    expect(onAdded).not.toHaveBeenCalled()

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Save failed/)).not.toBeInTheDocument()
  })

  it('expired session on the first write calls onAuthExpired once and renders no alert', async () => {
    vi.mocked(putProductVariants).mockRejectedValue(new AuthExpiredError('Session expired'))
    const onAuthExpired = vi.fn()
    render(<AddVariantPanel {...defaultProps()} onAuthExpired={onAuthExpired} />)

    generateXlRow('4')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    expect(onAuthExpired).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(batchAdjustStock).not.toHaveBeenCalled()
  })

  it('expired session on the second write calls onAuthExpired once and renders no alert', async () => {
    vi.mocked(putProductVariants).mockResolvedValue({})
    vi.mocked(batchAdjustStock).mockRejectedValue(new AuthExpiredError('Session expired'))
    const onAuthExpired = vi.fn()
    const onPartialFailure = vi.fn()
    render(<AddVariantPanel {...defaultProps()} onAuthExpired={onAuthExpired} onPartialFailure={onPartialFailure} />)

    generateXlRow('4')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add variant/i }))
    })

    expect(onAuthExpired).toHaveBeenCalledTimes(1)
    expect(onPartialFailure).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders no remove/delete-saved-variant control and no priceAdjustment control (D-16/D-20)', () => {
    render(<AddVariantPanel {...defaultProps()} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'XL' } })

    expect(screen.queryByRole('button', { name: /remove .*variant/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/price adjustment/i)).not.toBeInTheDocument()
  })
})
