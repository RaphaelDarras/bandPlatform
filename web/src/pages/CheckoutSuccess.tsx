import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCartStore } from '../lib/cartStore'

// Optimistic post-payment success page (SHOP-04/SHOP-05, `/checkout/success`).
// Reads the order number from the query string and renders a static
// thank-you -- makes NO fetch to the API, NO polling for webhook completion
// (D-15). The webhook (Plan 06) is the sole paid-state authority: a forged
// /checkout/success?order=... URL never marks anything paid here, it only
// clears the local cart (T-06-17). No loader/getStaticPaths -- deliberately
// excluded from the static prerender (D-06), matching ShopDetail.tsx's
// runtime-only precedent. Heading/body/CTA block shape copied from
// Cart.tsx's empty-cart state (lines 61-79).

export function Component() {
  const [searchParams] = useSearchParams()
  const orderNumber = searchParams.get('order')

  useEffect(() => {
    // Clear the cart exactly once on mount -- a one-time side-effect of
    // landing here, not tied to any prop/state (D-15).
    useCartStore.getState().clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Order Confirmed</h1>
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <h2 className="font-display text-3xl uppercase text-white">Thank you!</h2>
        {orderNumber && (
          <p className="font-sans text-base text-white/75">Order {orderNumber} confirmed.</p>
        )}
        <p className="font-sans text-base text-white/75">
          A confirmation email is on its way.
        </p>
        <Link
          to="/shop"
          className="mt-4 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
        >
          Browse Shop
        </Link>
      </div>
    </section>
  )
}

export default Component
