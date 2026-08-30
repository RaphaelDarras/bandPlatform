import type { PreorderProduct } from '../lib/shopify'

// Thumbnail cards for the featured album preorders. Images come straight from
// the Shopify CDN (already global + cached), so nothing is copied into
// public/images and the artwork updates when the band updates the product.
//
// Each card is its own deep link to the product page — the section used to
// carry a single button to the store root, which told the visitor nothing
// about what they were buying.
export default function PreorderGrid({ products }: { products: PreorderProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {products.map((p) => (
        <li key={p.handle}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border border-[var(--color-hairline)] transition-colors hover:border-[var(--color-accent)]"
          >
            {p.image && (
              <img
                src={p.image}
                alt={p.label}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            )}
            <div className="p-3">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.06em] text-white">
                {p.label}
              </p>
              <p className="mt-1 font-sans text-xs text-white/75">
                {p.available ? p.price : 'Sold out'}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}
