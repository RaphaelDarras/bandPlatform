// Accessible +/- quantity control (D-18). Controlled via props only — no
// internal state. Bounded 1..max: '−' disables at value<=1, '+' disables at
// value>=max; both disable when the `disabled` prop is set (e.g. before a
// variant is selected). Each button is a 44x44 tap target (h-11 w-11),
// following Header.tsx's inline-SVG icon convention (stroke="currentColor").

type QuantityStepperProps = {
  value: number
  max: number
  onChange: (n: number) => void
  disabled?: boolean
}

export default function QuantityStepper({ value, max, onChange, disabled = false }: QuantityStepperProps) {
  const decreaseDisabled = disabled || value <= 1
  const increaseDisabled = disabled || value >= max

  return (
    <div className="flex items-center border border-[var(--color-hairline)]">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={decreaseDisabled}
        onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center text-white disabled:text-white/30"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 8h12" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      <span className="font-sans text-sm font-semibold text-white">{value}</span>

      <button
        type="button"
        aria-label="Increase quantity"
        disabled={increaseDisabled}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center text-white disabled:text-white/30"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </div>
  )
}
