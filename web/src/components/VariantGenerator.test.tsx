import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VariantGenerator } from './VariantGenerator'

// Live-regeneration, edit-preservation, prune, and collision-warning
// coverage for the shared size x colour generator (D-15/D-13/D-14/D-19).
// Uses fireEvent (not user-event) per the codebase convention.

describe('VariantGenerator', () => {
  it('produces one row per size with color: null when colours is empty', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows).toEqual([
      { sku: 'TSHIRT-S', size: 'S', color: null, stock: 0, skuEdited: false },
      { sku: 'TSHIRT-M', size: 'M', color: null, stock: 0, skuEdited: false },
    ])
  })

  it('produces one row per size x colour combination in size-major order', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })
    fireEvent.change(screen.getByLabelText('Colours (optional)'), { target: { value: 'Black, White' } })

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows.map((r: { sku: string }) => r.sku)).toEqual([
      'TSHIRT-S-BLK',
      'TSHIRT-S-WHI',
      'TSHIRT-M-BLK',
      'TSHIRT-M-WHI',
    ])
  })

  it('ignores whitespace and empty comma-separated segments', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, , M ,' } })

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows).toHaveLength(2)
    expect(rows.map((r: { size: string | null }) => r.size)).toEqual(['S', 'M'])
  })

  it('produces one row per colour with size: null when sizes is empty', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Colours (optional)'), { target: { value: 'Black, White' } })

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows).toEqual([
      { sku: 'TSHIRT-BLK', size: null, color: 'Black', stock: 0, skuEdited: false },
      { sku: 'TSHIRT-WHI', size: null, color: 'White', stock: 0, skuEdited: false },
    ])
  })

  it('preserves an overwritten SKU across a Colours-field change for the surviving combination', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('Colours (optional)'), { target: { value: 'Black' } })

    fireEvent.change(screen.getByLabelText('SKU for M / Black'), { target: { value: 'CUSTOM-SKU' } })

    fireEvent.change(screen.getByLabelText('Colours (optional)'), { target: { value: 'Black, White' } })

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows).toEqual([
      { sku: 'CUSTOM-SKU', size: 'M', color: 'Black', stock: 0, skuEdited: true },
      { sku: 'TSHIRT-M-WHI', size: 'M', color: 'White', stock: 0, skuEdited: false },
    ])
  })

  it('updates stock for a row and preserves it across a Sizes-field change for the surviving combination', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })
    fireEvent.change(screen.getByLabelText('Opening stock for M / —'), { target: { value: '7' } })

    let rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows.find((r: { size: string | null }) => r.size === 'M').stock).toBe(7)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M, L' } })

    rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows.find((r: { size: string | null }) => r.size === 'M').stock).toBe(7)
    expect(rows.find((r: { size: string | null }) => r.size === 'L').stock).toBe(0)
  })

  it('prunes a row via its unique aria-label and fires onRowsChange with one fewer row', () => {
    const onRowsChange = vi.fn()
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })
    fireEvent.change(screen.getByLabelText('Colours (optional)'), { target: { value: 'Black' } })

    fireEvent.click(screen.getByLabelText('Remove M / Black from preview'))

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows).toHaveLength(1)
    expect(rows[0].size).toBe('S')
  })

  it('shows a non-blocking warning when two preview rows share the same SKU', () => {
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })
    const skuS = screen.getByLabelText('SKU for S / —')
    const skuM = screen.getByLabelText('SKU for M / —')

    fireEvent.change(skuS, { target: { value: 'DUP-SKU' } })
    fireEvent.change(skuM, { target: { value: 'DUP-SKU' } })

    const warnings = screen.getAllByText('This SKU is already in use.')
    expect(warnings).toHaveLength(2)
    expect(skuS).not.toBeDisabled()
    expect(skuM).not.toBeDisabled()
  })

  it('shows the same warning when a generated row collides with an existingSkus entry', () => {
    render(<VariantGenerator productName="T-Shirt" existingSkus={['TSHIRT-M-BLK']} onRowsChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('Colours (optional)'), { target: { value: 'Black' } })

    expect(screen.getByText('This SKU is already in use.')).toBeInTheDocument()
    expect(screen.getByLabelText('SKU for M / Black')).not.toBeDisabled()
  })

  it('updates un-edited SKUs live when productName changes but leaves an edited SKU alone', () => {
    const onRowsChange = vi.fn()
    const { rerender } = render(
      <VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={onRowsChange} />,
    )

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })
    fireEvent.change(screen.getByLabelText('SKU for M / —'), { target: { value: 'KEEP-ME' } })

    rerender(<VariantGenerator productName="Hoodie" existingSkus={[]} onRowsChange={onRowsChange} />)

    const rows = onRowsChange.mock.calls.at(-1)?.[0]
    expect(rows.find((r: { size: string | null }) => r.size === 'S').sku).toBe('HOODIE-S')
    expect(rows.find((r: { size: string | null }) => r.size === 'M').sku).toBe('KEEP-ME')
  })

  it('renders every opening-stock input with min="0"', () => {
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Sizes'), { target: { value: 'S, M' } })

    expect(screen.getByLabelText('Opening stock for S / —')).toHaveAttribute('min', '0')
    expect(screen.getByLabelText('Opening stock for M / —')).toHaveAttribute('min', '0')
  })

  it('renders nothing in the preview table when both fields are empty', () => {
    render(<VariantGenerator productName="T-Shirt" existingSkus={[]} onRowsChange={vi.fn()} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
