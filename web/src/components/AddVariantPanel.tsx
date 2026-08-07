import { useState, type FormEvent } from 'react'
import { VariantGenerator, type GeneratedVariantRow } from './VariantGenerator'
import { putProductVariants, batchAdjustStock, AuthExpiredError, type StockVariant } from '../lib/inventory'

// Add-variant panel (INV-07, UI-SPEC §5) -- adds new variants to an already
// existing, already-saved product. This is the sibling of CreateProductPanel
// (06.1-06): that panel creates a whole product, this one only appends
// variants to one, and the two riskiest behaviours in this phase both live
// here.
//
// D-19: renders the same shared VariantGenerator the create panel uses --
// no size/colour/SKU logic is duplicated in this file.
//
// D-16: this panel ADDS variants only. It has no remove/delete-saved-variant
// control anywhere, and it never builds a payload that omits an existing
// SKU -- variant removal is out of scope until Phase 7 D-15 adds a
// variant-level `active` flag.
//
// D-20/D-10/D-12: no priceAdjustment field, and no name/description/
// basePrice/images field -- this panel does not touch product content.
//
// Form class conventions below are copied from Checkout.tsx lines 71-74 (not
// imported -- Phase 7 D-18 deletes that file whole).

export type PendingVariantSeed = {
  sku: string
  size: string | null
  color: string | null
  intendedStock: number
}

export type AddVariantPanelProps = {
  token: string
  productId: string
  productName: string
  existingVariants: StockVariant[]
  existingSkus: string[]
  onAdded: () => void
  onPartialFailure: (seeds: PendingVariantSeed[], message: string) => void
  onCancel: () => void
  onAuthExpired: () => void
}

const errorClassName = 'min-h-5 font-sans text-sm text-[#ef4444]'

export function AddVariantPanel(props: AddVariantPanelProps) {
  const [rows, setRows] = useState<GeneratedVariantRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const canSubmit = rows.length > 0 && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    try {
      // D-17 (the dangerous one): PUT /api/products/:id computes
      // skusToRemove = existing - incoming and $pulls every SKU missing from
      // the payload, so this array MUST spread every one of the product's
      // EXISTING variants before appending the new rows -- a payload
      // containing only the new rows would silently delete all the others.
      // `stock` is intentionally omitted from the new rows: it is excluded
      // from the endpoint's allowedVariantFields, so a new variant always
      // lands at 0 no matter what is sent, which is why the quantity is a
      // second, separate call below.
      const payload = [
        ...props.existingVariants.map((v) => ({ sku: v.sku, size: v.size, color: v.color })),
        ...rows.map((r) => ({ sku: r.sku, size: r.size, color: r.color, priceAdjustment: 0 })),
      ]

      await putProductVariants(props.token, props.productId, payload)

      // Step 2 (D-18, the chained write). Every new variant now exists at
      // stock: 0. Only rows with a non-zero intended opening count need the
      // follow-up adjustment; if none do, the action is already complete.
      const toAdjust = rows.filter((r) => r.stock !== 0)
      if (toAdjust.length > 0) {
        try {
          await batchAdjustStock(
            props.token,
            toAdjust.map((r) => ({ productId: props.productId, variantSku: r.sku, quantity: r.stock })),
          )
        } catch (err) {
          if (err instanceof AuthExpiredError) {
            props.onAuthExpired()
            return
          }
          // D-18 (mandatory, specific hand-off): the variant row(s) already
          // exist server-side at stock 0 -- the PUT above succeeded. A
          // generic error banner here is explicitly forbidden by CONTEXT.md
          // because it would leave the admin unable to tell that a phantom
          // 0-stock variant now exists. The specific copy --
          // "Variant {sku} was created at 0 — its starting quantity wasn't
          // saved. Enter the correct count below and save." -- is rendered
          // by the PARENT (Stock.tsx, plan 06.1-10) on the affected table
          // row(s) once it re-fetches and finds them, using the seeds and
          // message handed back here. This deliberately differs from D-06's
          // generic all-or-nothing batch-save banner (RESEARCH Pitfall 2:
          // the two failure vocabularies must not be unified).
          const seeds: PendingVariantSeed[] = toAdjust.map((r) => ({
            sku: r.sku,
            size: r.size,
            color: r.color,
            intendedStock: r.stock,
          }))
          const message = err instanceof Error ? err.message : 'Failed to save opening stock.'
          props.onPartialFailure(seeds, message)
          return
        }
      }

      props.onAdded()
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        // D-30 (binding): drop straight to the parent's logout path. No
        // retry, no draft preservation, no unsaved-changes warning.
        props.onAuthExpired()
        return
      }
      // Step 1 failed: nothing was created (PUT never committed), so there
      // is nothing to recover -- keep the panel open with every generated
      // row intact and call neither onAdded nor onPartialFailure.
      setSubmitError(err instanceof Error ? err.message : 'Failed to add variant. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6">
      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="flex flex-col gap-4">
          <legend className="font-display text-xl uppercase text-white">Add Variant</legend>

          <VariantGenerator
            productName={props.productName}
            existingSkus={props.existingSkus}
            onRowsChange={setRows}
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={props.onCancel}
              className="h-11 flex-1 rounded-md border border-[var(--color-hairline)] bg-transparent px-6 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`h-11 flex-1 rounded-md px-6 font-sans text-sm font-semibold uppercase tracking-[0.06em] ${
                canSubmit ? 'bg-[var(--color-accent)] text-black' : 'bg-white/20 text-white/40'
              }`}
            >
              {submitting ? 'Adding…' : 'Add variant(s)'}
            </button>
          </div>

          {submitError && (
            <p role="alert" className={errorClassName}>
              {submitError}
            </p>
          )}
        </fieldset>
      </form>
    </div>
  )
}
