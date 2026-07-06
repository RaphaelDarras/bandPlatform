import { useState, type ChangeEvent, type FocusEvent, type FormEvent } from 'react'
import { useCartStore } from '../lib/cartStore'
import { createOrder } from '../lib/orders'
import { formatPrice } from '../lib/format'

// Checkout page (SHOP-03/SHOP-04/SHOP-05, `/checkout`). Guest checkout: on
// submit, builds the order payload from the form + cart and calls
// createOrder() (web/src/lib/orders.ts), then redirects the browser to the
// returned hosted-provider URL (D-02/D-05). A rejected createOrder shows an
// inline error (reusing errorClassName) rather than a silent no-op
// (T-06-16). The customer picks Stripe-card vs PayPal before submit (D-03).
//
// Country is a free-text input, not a <select> (D-04) — shipping
// restrictions/validation are deferred to Phase 7. All free-text fields
// carry a maxLength bound (T-5-15).
//
// Input styling + the min-h-5 error-slot pattern are copied verbatim from
// Stock.tsx's login form — the only other hand-rolled controlled-input form
// in this codebase — per 05-PATTERNS.md/06-PATTERNS.md.

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
type PaymentMethod = 'stripe' | 'paypal'

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

const REQUIRED_FIELDS = (Object.keys(initialFields) as (keyof FormFields)[]).filter(
  (field) => field !== 'addressLine2',
)

const inputClassName =
  'mt-1 w-full rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 font-sans text-white'
const errorClassName = 'min-h-5 font-sans text-sm text-[#ef4444]'
const labelClassName = 'font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white'

export function Component() {
  const lines = useCartStore((s) => s.lines)
  const [fields, setFields] = useState<FormFields>(initialFields)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({})
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const allFieldsValid = REQUIRED_FIELDS.every((field) => validateField(field, fields[field]) === '')

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError('')

    // Belt-and-braces: re-validate everything on submit (the button is
    // already disabled until allFieldsValid, but guard here too).
    const nextErrors: FieldErrors = {}
    for (const field of REQUIRED_FIELDS) {
      nextErrors[field] = validateField(field, fields[field])
    }
    setErrors(nextErrors)
    setTouched(
      REQUIRED_FIELDS.reduce((acc, field) => ({ ...acc, [field]: true }), {} as Record<keyof FormFields, boolean>),
    )
    if (Object.values(nextErrors).some((msg) => msg)) return

    setSubmitting(true)
    try {
      const { redirectUrl } = await createOrder({
        customerEmail: fields.email,
        customerName: fields.name || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          variantSku: l.variantSku,
          quantity: l.quantity,
        })),
        shippingAddress: {
          addressLine1: fields.addressLine1,
          addressLine2: fields.addressLine2 || undefined,
          city: fields.city,
          postalCode: fields.postalCode,
          country: fields.country,
        },
        paymentMethod,
      })
      window.location.href = redirectUrl
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create order. Please try again.',
      )
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="font-display text-3xl uppercase text-white">Checkout</h1>

      <form className="mt-6 flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
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

        <fieldset className="flex flex-col gap-3">
          <legend className="font-display text-xl uppercase text-white">Payment Method</legend>
          <label className="flex items-center gap-2 font-sans text-sm text-white">
            <input
              type="radio"
              name="paymentMethod"
              value="stripe"
              checked={paymentMethod === 'stripe'}
              onChange={() => setPaymentMethod('stripe')}
            />
            Credit / Debit Card
          </label>
          <label className="flex items-center gap-2 font-sans text-sm text-white">
            <input
              type="radio"
              name="paymentMethod"
              value="paypal"
              checked={paymentMethod === 'paypal'}
              onChange={() => setPaymentMethod('paypal')}
            />
            PayPal
          </label>
        </fieldset>

        <div className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4">
          <h2 className="font-display text-3xl uppercase text-white">Order Summary</h2>
          <p className="mt-2 font-sans text-base text-white/75">Subtotal: {formatPrice(subtotal)}</p>
        </div>

        <div>
          <button
            type="submit"
            disabled={!allFieldsValid || submitting}
            className={`w-full px-6 py-3 text-center font-sans text-sm font-semibold uppercase tracking-[0.06em] ${
              !allFieldsValid || submitting
                ? 'bg-white/20 text-white/40 cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-black'
            }`}
          >
            {submitting ? 'Placing Order…' : 'Place Order'}
          </button>
          <div className={errorClassName}>{submitError}</div>
        </div>
      </form>
    </section>
  )
}

export default Component
