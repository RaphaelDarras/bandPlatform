import type { ChangeEvent } from 'react'

// Per-variant stock control (D-01/D-07/D-08). Fully controlled, no internal
// state — both input paths (+/-1 buttons and the absolute set-count field)
// read and write the single `value` prop, which is the pending count.
//
// Deliberately diverges from QuantityStepper.tsx: that component hard-floors
// at value<=1 and ceils at max. D-07 requires the opposite here — negative
// stock is reachable by design (the POS never rejects a concert sale), so
// neither button nor the field enforces any bound.

export type StockQuantityInputProps = {
  productName: string
  sku: string
  size: string | null
  color: string | null
  value: number
  serverValue: number
  onChange: (next: number) => void
  error?: string
  warning?: string
  disabled?: boolean
}

// Single source of truth for D-08's <5 threshold. Closes Phase 5 D-15: the
// old Stock.tsx helper used stock===0 for danger and <=5 for warning; this
// one uses <=0 (so negative stock, newly reachable per D-07, is also danger)
// and <5 (so exactly 5 is normal, not warning). A sibling storefront
// component duplicates the same hex literals but is deliberately NOT
// touched by this plan — a later phase deletes that file wholesale along
// with the rest of the storefront it belongs to.
export function stockColorClass(stock: number): string {
  if (stock <= 0) return 'text-[var(--color-stock-danger)]'
  if (stock < 5) return 'text-[var(--color-stock-warning)]'
  return 'text-[var(--color-stock-normal)]'
}

export function StockQuantityInput({
  productName,
  sku,
  size,
  color,
  value,
  serverValue,
  onChange,
  error,
  warning,
  disabled = false,
}: StockQuantityInputProps) {
  const dirty = value !== serverValue
  const wasId = `was-${sku}`
  const errId = `err-${sku}`
  const labelId = `stock-label-${sku}`

  const describedBy = [dirty ? wasId : null, error ? errId : null].filter(Boolean).join(' ') || undefined

  function handleFieldChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '' || raw === '-') {
      if (raw === '') onChange(0)
      // A lone '-' is an in-progress negative number; don't emit yet.
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isNaN(parsed)) onChange(parsed)
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`font-sans text-sm font-semibold ${stockColorClass(value)}`}>{value}</span>

      {dirty && (
        <span id={wasId} className="font-sans text-xs text-white/40">
          (was {serverValue})
        </span>
      )}

      <button
        type="button"
        aria-label={`Decrease stock for ${sku}`}
        disabled={disabled}
        onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center text-white border border-[var(--color-hairline)] disabled:text-white/30"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 8h12" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      <label id={labelId} htmlFor={`stock-input-${sku}`} className="sr-only">
        {`Set stock for ${productName}, ${size ?? '—'} / ${color ?? '—'} (${sku})`}
      </label>
      <input
        id={`stock-input-${sku}`}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={handleFieldChange}
        disabled={disabled}
        aria-describedby={describedBy}
        className="h-11 w-16 border border-[var(--color-hairline)] bg-[var(--color-surface)] px-1 text-center font-sans text-sm text-white"
      />

      <button
        type="button"
        aria-label={`Increase stock for ${sku}`}
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center text-white border border-[var(--color-hairline)] disabled:text-white/30"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {error && (
        <p role="alert" id={errId} className="font-sans text-xs text-[var(--color-stock-danger)]">
          {error}
        </p>
      )}

      {warning && (
        <p aria-live="polite" className="font-sans text-xs text-[var(--color-stock-warning)]">
          {warning}
        </p>
      )}
    </div>
  )
}
