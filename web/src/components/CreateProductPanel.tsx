import { useState, type ChangeEvent, type FocusEvent, type FormEvent } from 'react'
import { VariantGenerator, type GeneratedVariantRow } from './VariantGenerator'

// Create-product panel (INV-05, UI-SPEC §4). Inline collapsible panel — NOT
// a modal — mounted by Stock.tsx (plan 06.1-10) only while open; this
// component owns no open/closed state of its own.
//
// D-12: collects exactly name, base price and category, plus the rows
// emitted by the shared VariantGenerator (D-19) — no description field, no
// images field, no tax/VAT field anywhere, because prices are all-inclusive
// EUR under the French franchise en base de TVA (art. 293 B du CGI).
//
// D-10: this panel CREATES only. It has no field or control that edits an
// already-saved product's name, description, base price or images, because
// Phase 7 makes Shopify the content master.
//
// Form conventions below (labelClassName/inputClassName/errorClassName,
// validate-on-blur via validateField, canSubmit derived inline each render)
// are copied from Checkout.tsx's fieldset/legend pattern, not imported --
// Phase 7 D-18 deletes that file whole.

export type CreateProductPanelProps = {
  token: string
  existingSkus: string[]
  onCreated: () => void
  onCancel: () => void
  onAuthExpired: () => void
}

type FieldName = 'name' | 'basePrice'

const labelClassName = 'font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white'
const inputClassName =
  'mt-1 h-11 w-full rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 font-sans text-white'
const errorClassName = 'min-h-5 font-sans text-sm text-[#ef4444]'

function validateField(field: FieldName, value: string): string {
  if (field === 'name') {
    return value.trim() === '' ? 'Name is required.' : ''
  }
  const trimmed = value.trim()
  if (trimmed === '') return 'Base price is required.'
  const parsed = Number(trimmed)
  if (Number.isNaN(parsed) || parsed < 0) return 'Base price must be a non-negative number.'
  return ''
}

export function CreateProductPanel(props: CreateProductPanelProps) {
  const [name, setName] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [category, setCategory] = useState('')
  const [rows, setRows] = useState<GeneratedVariantRow[]>([])
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const canSubmit =
    name.trim() !== '' && basePrice.trim() !== '' && Number(basePrice) >= 0 && rows.length > 0 && !submitting

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setName(value)
    if (touched.name) {
      setErrors((prev) => ({ ...prev, name: validateField('name', value) }))
    }
  }

  function handleBasePriceChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setBasePrice(value)
    if (touched.basePrice) {
      setErrors((prev) => ({ ...prev, basePrice: validateField('basePrice', value) }))
    }
  }

  function handleCategoryChange(e: ChangeEvent<HTMLInputElement>) {
    setCategory(e.target.value)
  }

  function handleBlur(field: FieldName) {
    return (e: FocusEvent<HTMLInputElement>) => {
      setTouched((t) => ({ ...t, [field]: true }))
      setErrors((prev) => ({ ...prev, [field]: validateField(field, e.target.value) }))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Task 2 (06.1-06) wires the createProduct call and success/failure
    // handling in here.
    setSubmitError('')
    setSubmitting(true)
    setSubmitting(false)
  }

  return (
    <div className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6">
      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="flex flex-col gap-4">
          <legend className="font-display text-xl uppercase text-white">New Product</legend>

          <div>
            <label className={labelClassName} htmlFor="create-product-name">
              Name
            </label>
            <input
              id="create-product-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              onBlur={handleBlur('name')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.name}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="create-product-price">
              Base price (€)
            </label>
            <input
              id="create-product-price"
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={handleBasePriceChange}
              onBlur={handleBlur('basePrice')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.basePrice}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="create-product-category">
              Category
            </label>
            <input
              id="create-product-category"
              type="text"
              value={category}
              onChange={handleCategoryChange}
              className={inputClassName}
            />
          </div>

          <VariantGenerator productName={name} existingSkus={props.existingSkus} onRowsChange={setRows} />

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
              {submitting ? 'Creating…' : 'Create product'}
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
