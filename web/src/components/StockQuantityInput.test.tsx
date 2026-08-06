import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StockQuantityInput, stockColorClass } from './StockQuantityInput'

// StockQuantityInput — D-01/D-07/D-08 per-variant control. Unlike
// QuantityStepper.tsx (bounded 1..max, disables at the edges), this control
// is deliberately unbounded in both directions — the tests below pin the
// opposite behaviour at every boundary QuantityStepper would have clamped.
describe('stockColorClass — D-08 boundary (<=0 danger, <5 warning, >=5 normal)', () => {
  it('returns danger for negative and zero stock', () => {
    expect(stockColorClass(-3)).toBe('text-[var(--color-stock-danger)]')
    expect(stockColorClass(0)).toBe('text-[var(--color-stock-danger)]')
  })

  it('returns warning for 1 and 4', () => {
    expect(stockColorClass(1)).toBe('text-[var(--color-stock-warning)]')
    expect(stockColorClass(4)).toBe('text-[var(--color-stock-warning)]')
  })

  it('returns normal for exactly 5 and above (5 is normal, not warning)', () => {
    expect(stockColorClass(5)).toBe('text-[var(--color-stock-normal)]')
    expect(stockColorClass(12)).toBe('text-[var(--color-stock-normal)]')
  })
})

describe('StockQuantityInput — no floor/ceiling (D-07)', () => {
  const baseProps = {
    productName: 'T-Shirt',
    sku: 'TS-M-BLK',
    size: 'M',
    color: 'Black',
    serverValue: 0,
  }

  it('minus button at value 0 is not disabled and emits -1', () => {
    const onChange = vi.fn()
    render(<StockQuantityInput {...baseProps} value={0} onChange={onChange} />)
    const decrease = screen.getByLabelText('Decrease stock for TS-M-BLK')
    expect(decrease).not.toBeDisabled()
    fireEvent.click(decrease)
    expect(onChange).toHaveBeenCalledWith(-1)
  })

  it('minus button at value -3 is not disabled and emits -4', () => {
    const onChange = vi.fn()
    render(<StockQuantityInput {...baseProps} value={-3} onChange={onChange} />)
    const decrease = screen.getByLabelText('Decrease stock for TS-M-BLK')
    expect(decrease).not.toBeDisabled()
    fireEvent.click(decrease)
    expect(onChange).toHaveBeenCalledWith(-4)
  })

  it('plus button at a large value is not disabled and emits value+1', () => {
    const onChange = vi.fn()
    render(<StockQuantityInput {...baseProps} value={9999} onChange={onChange} />)
    const increase = screen.getByLabelText('Increase stock for TS-M-BLK')
    expect(increase).not.toBeDisabled()
    fireEvent.click(increase)
    expect(onChange).toHaveBeenCalledWith(10000)
  })

  it('typing 42 into the field emits onChange(42)', () => {
    const onChange = vi.fn()
    render(<StockQuantityInput {...baseProps} value={0} onChange={onChange} />)
    const input = screen.getByLabelText('Set stock for T-Shirt, M / Black (TS-M-BLK)')
    fireEvent.change(input, { target: { value: '42' } })
    expect(onChange).toHaveBeenCalledWith(42)
  })

  it('typing -7 into the field emits onChange(-7)', () => {
    const onChange = vi.fn()
    render(<StockQuantityInput {...baseProps} value={0} onChange={onChange} />)
    const input = screen.getByLabelText('Set stock for T-Shirt, M / Black (TS-M-BLK)')
    fireEvent.change(input, { target: { value: '-7' } })
    expect(onChange).toHaveBeenCalledWith(-7)
  })

  it('the field carries no min attribute', () => {
    render(<StockQuantityInput {...baseProps} value={0} onChange={vi.fn()} />)
    const input = screen.getByLabelText('Set stock for T-Shirt, M / Black (TS-M-BLK)')
    expect(input).not.toHaveAttribute('min')
  })
})

describe('StockQuantityInput — per-row-unique accessible names', () => {
  it('two instances with different SKUs produce distinct accessible names', () => {
    render(
      <>
        <StockQuantityInput
          productName="T-Shirt"
          sku="TS-M-BLK"
          size="M"
          color="Black"
          value={2}
          serverValue={2}
          onChange={vi.fn()}
        />
        <StockQuantityInput
          productName="T-Shirt"
          sku="TS-L-WHT"
          size="L"
          color="White"
          value={3}
          serverValue={3}
          onChange={vi.fn()}
        />
      </>,
    )
    const decreaseButtons = screen.getAllByLabelText(/Decrease stock for/)
    expect(decreaseButtons).toHaveLength(2)
    const names = decreaseButtons.map((el) => el.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(2)
  })
})

describe('StockQuantityInput — dirty caption, warning, error', () => {
  const baseProps = {
    productName: 'T-Shirt',
    sku: 'TS-M-BLK',
    size: 'M' as string | null,
    color: 'Black' as string | null,
  }

  it('shows "(was 9)" when value differs from serverValue', () => {
    render(<StockQuantityInput {...baseProps} value={3} serverValue={9} onChange={vi.fn()} />)
    expect(screen.getByText('(was 9)')).toBeInTheDocument()
  })

  it('does not show a "(was N)" caption when value equals serverValue', () => {
    render(<StockQuantityInput {...baseProps} value={9} serverValue={9} onChange={vi.fn()} />)
    expect(screen.queryByText(/\(was/)).not.toBeInTheDocument()
  })

  it('renders a warning inside an aria-live="polite" element', () => {
    render(
      <StockQuantityInput
        {...baseProps}
        value={0}
        serverValue={0}
        onChange={vi.fn()}
        warning="Variant TS-M-BLK was created at 0 — its starting quantity wasn't saved."
      />,
    )
    const warningEl = screen.getByText(/was created at 0/)
    expect(warningEl).toHaveAttribute('aria-live', 'polite')
  })

  it('renders an error inside a role="alert" element', () => {
    render(<StockQuantityInput {...baseProps} value={0} serverValue={0} onChange={vi.fn()} error="Couldn't save this change — try again." />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save this change — try again.")
  })
})
