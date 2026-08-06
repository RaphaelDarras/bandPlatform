import { useEffect, useRef } from 'react'

// Deactivation confirmation dialog (D-22/D-23). Native <dialog> — the first
// modal in this codebase — chosen over a hand-rolled overlay/focus-trap
// because showModal() provides the backdrop, focus trap and Escape-to-close
// for free. jsdom@24.1.3 (this project's installed version) does not
// implement HTMLDialogElement.prototype.showModal/close, so both calls are
// feature-detected; an unguarded call throws in every test. Drop the guard
// once the project's jsdom is upgraded past the version that ships them.

export type DeactivateDialogProps = {
  open: boolean
  productName: string
  productTotal: number
  onConfirm: () => void
  onCancel: () => void
}

export function DeactivateDialog({ open, productName, productTotal, onConfirm, onCancel }: DeactivateDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) {
      if (typeof el.showModal === 'function') el.showModal()
    } else {
      if (typeof el.close === 'function') el.close()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby="deactivate-dialog-title"
      className="max-w-sm border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6 backdrop:bg-black/60"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h2 id="deactivate-dialog-title" className="font-display text-xl uppercase text-white">
        Deactivate {productName}?
      </h2>

      <p className="mt-2 font-sans text-sm">
        This product will be hidden from the catalogue. You can restore it later from the Archived view.
      </p>

      {productTotal > 0 && (
        <p className="mt-2 font-sans text-sm font-semibold text-[var(--color-stock-warning)]">
          This product still has {productTotal} units in stock.
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="h-11 border border-[var(--color-hairline)] px-4 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 bg-[#ef4444] px-4 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white"
        >
          Deactivate
        </button>
      </div>
    </dialog>
  )
}
