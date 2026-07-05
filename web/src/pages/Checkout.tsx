import { useState, type ChangeEvent, type FocusEvent } from 'react'
import { useCartStore } from '../lib/cartStore'

// Checkout page (SHOP-03, `/checkout`). Guest checkout FORM ONLY — no Order
// is persisted and no payment is processed this phase (D-01). The "Place
// Order" button below carries an unconditional `disabled` attribute, is
// `type="button"`, and the <form> has no `onSubmit` — there is no submit
// path to the network anywhere in this file (D-03/T-5-16). Payment + Order
// persistence land in Phase 6.
//
// Country is a free-text input, not a <select> (D-04) — shipping
// restrictions/validation are deferred to Phase 7. All free-text fields
// carry a maxLength bound (T-5-15) since nothing here is sent to (or
// validated by) the API this phase.
//
// Input styling + the min-h-5 error-slot pattern are copied verbatim from
// Stock.tsx's login form — the only other hand-rolled controlled-input form
// in this codebase — per 05-PATTERNS.md.

interface FormFields {
  email: string
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  postalCode: string
  country: string
}

type FieldErrors = Partial<Record<keyof FormFields, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const initialFields: FormFields = {
  email: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  country: '',
}

const FIELD_LABELS: Record<keyof FormFields, string> = {
  email: 'Email',
  name: 'Name',
  addressLine1: 'Address',
  addressLine2: 'Address line 2',
  city: 'City',
  postalCode: 'Postal code',
  country: 'Country',
}

function validateField(field: keyof FormFields, value: string): string {
  if (field === 'addressLine2') return '' // optional
  if (field === 'email') {
    if (!value.trim()) return 'Email is required.'
    if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.'
    return ''
  }
  if (!value.trim()) return `${FIELD_LABELS[field]} is required.`
  return ''
}

const inputClassName =
  'mt-1 w-full rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 font-sans text-white'
const errorClassName = 'min-h-5 font-sans text-sm text-[#ef4444]'
const labelClassName = 'font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white'

export function Component() {
  const lines = useCartStore((s) => s.lines)
  const [fields, setFields] = useState<FormFields>(initialFields)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({})

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  function handleChange(field: keyof FormFields) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setFields((f) => ({ ...f, [field]: value }))
      if (touched[field]) {
        setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }))
      }
    }
  }

  function handleBlur(field: keyof FormFields) {
    return (e: FocusEvent<HTMLInputElement>) => {
      setTouched((t) => ({ ...t, [field]: true }))
      setErrors((prev) => ({ ...prev, [field]: validateField(field, e.target.value) }))
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="font-display text-3xl uppercase text-white">Checkout</h1>

      {/* No onSubmit — form-only this phase, nothing is ever submitted (D-01). */}
      <form className="mt-6 flex flex-col gap-6" noValidate>
        <fieldset className="flex flex-col gap-4">
          <legend className="font-display text-xl uppercase text-white">Contact</legend>
          <div>
            <label className={labelClassName} htmlFor="checkout-email">
              Email
            </label>
            <input
              id="checkout-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={fields.email}
              onChange={handleChange('email')}
              onBlur={handleBlur('email')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.email}</div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="font-display text-xl uppercase text-white">Shipping</legend>

          <div>
            <label className={labelClassName} htmlFor="checkout-name">
              Name
            </label>
            <input
              id="checkout-name"
              type="text"
              maxLength={100}
              autoComplete="name"
              value={fields.name}
              onChange={handleChange('name')}
              onBlur={handleBlur('name')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.name}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="checkout-address1">
              Address Line 1
            </label>
            <input
              id="checkout-address1"
              type="text"
              maxLength={200}
              autoComplete="address-line1"
              value={fields.addressLine1}
              onChange={handleChange('addressLine1')}
              onBlur={handleBlur('addressLine1')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.addressLine1}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="checkout-address2">
              Address Line 2 (optional)
            </label>
            <input
              id="checkout-address2"
              type="text"
              maxLength={200}
              autoComplete="address-line2"
              value={fields.addressLine2}
              onChange={handleChange('addressLine2')}
              onBlur={handleBlur('addressLine2')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.addressLine2}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="checkout-city">
              City
            </label>
            <input
              id="checkout-city"
              type="text"
              maxLength={100}
              autoComplete="address-level2"
              value={fields.city}
              onChange={handleChange('city')}
              onBlur={handleBlur('city')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.city}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="checkout-postal">
              Postal Code
            </label>
            <input
              id="checkout-postal"
              type="text"
              maxLength={20}
              autoComplete="postal-code"
              value={fields.postalCode}
              onChange={handleChange('postalCode')}
              onBlur={handleBlur('postalCode')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.postalCode}</div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="checkout-country">
              Country
            </label>
            {/* Free-text, not a <select> (D-04) — shipping restrictions deferred to Phase 7. */}
            <input
              id="checkout-country"
              type="text"
              maxLength={56}
              autoComplete="country-name"
              value={fields.country}
              onChange={handleChange('country')}
              onBlur={handleBlur('country')}
              className={inputClassName}
            />
            <div className={errorClassName}>{errors.country}</div>
          </div>
        </fieldset>

        <div className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4">
          <h2 className="font-display text-3xl uppercase text-white">Order Summary</h2>
          <p className="mt-2 font-sans text-base text-white/75">Subtotal: ${subtotal} CAD</p>
        </div>

        <div>
          <button
            type="button"
            disabled
            className="w-full bg-white/20 px-6 py-3 text-center font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/40 cursor-not-allowed"
          >
            Place Order
          </button>
          <p className="mt-2 font-sans text-sm text-white/50">
            Online payment is coming soon — checkout will be enabled once payments launch.
          </p>
        </div>
      </form>
    </section>
  )
}

export default Component
