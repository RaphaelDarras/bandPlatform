import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { capturePaypalOrder } from '../lib/orders'

// PayPal return page (SHOP-04/SHOP-05, `/checkout/paypal-return`). PayPal
// redirects the browser here after the customer approves payment on
// PayPal's hosted page, appending its own `token` query param (the PayPal
// order id) alongside the `order` param our own returnUrl already carries
// (api/services/paypalClient.js's createPaypalOrder). Explicit capture is
// required -- approval alone does not move money (Pitfall 4) -- so this
// page calls capturePaypalOrder(token) exactly ONCE on mount, then
// redirects: success -> /checkout/success?order=..., failure/missing token
// -> /checkout/cancel. A single capture call then redirect, no polling
// loop (D-15). No loader/getStaticPaths -- deliberately excluded from the
// static prerender (D-06).

export function Component() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    const orderNumber = searchParams.get('order')

    if (!token) {
      navigate('/checkout/cancel', { replace: true })
      return
    }

    capturePaypalOrder(token)
      .then(({ status }) => {
        // WR-06 — PayPal explicitly documents PENDING (and other non-terminal
        // statuses) as a possible capture outcome for certain funding
        // sources. Only COMPLETED is genuine success; the webhook remains
        // the actual source of truth for fulfillment either way.
        if (status === 'COMPLETED') {
          navigate(`/checkout/success?order=${orderNumber ?? ''}`, { replace: true })
        } else {
          navigate('/checkout/cancel', { replace: true })
        }
      })
      .catch(() => navigate('/checkout/cancel', { replace: true }))
    // Run exactly once on mount -- a single capture call, not tied to any
    // prop/state re-evaluation (D-15).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="font-display text-3xl uppercase text-white">Finalizing your payment</h2>
      <p className="font-sans text-base text-white/75">
        Please wait while we confirm your PayPal payment…
      </p>
    </section>
  )
}

export default Component
