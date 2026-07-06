import { Link } from 'react-router-dom'

// Post-payment cancel page (SHOP-04/SHOP-05, `/checkout/cancel`). Reached
// when the customer backs out of Stripe Checkout, or their PayPal approval
// fails/is declined (D-16) -- returns them toward the cart rather than
// leaving them stranded. No charge is ever made on this path. Heading/
// body/CTA block shape copied from Cart.tsx's empty-cart state (lines
// 61-79). No loader/getStaticPaths -- deliberately excluded from the
// static prerender (D-06), matching ShopDetail.tsx's runtime-only
// precedent.

export function Component() {
  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Payment Cancelled</h1>
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <h2 className="font-display text-3xl uppercase text-white">No charge was made</h2>
        <p className="font-sans text-base text-white/75">
          Your payment was cancelled. Your cart is still saved, so you can try again whenever
          you're ready.
        </p>
        <Link
          to="/cart"
          className="mt-4 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
        >
          Return to Cart
        </Link>
      </div>
    </section>
  )
}

export default Component
