import { describe, it, expect } from 'vitest'
import {
  displayTitle,
  isPreorderProduct,
  productsEndpoint,
  sized,
  toCatalogue,
  toShopProduct,
  STORE_URL,
} from './shopify'

// Shape trimmed from the live shop.hurakanband.fr/products.json payload
// (verified 2026-08-30): titles are store-facing and shouty, prices are
// strings, images carry a ?v= cache key.
const products = [
  {
    handle: 'preorder-cd-eternal-scars',
    title: 'PREORDER - DIGIPACK - "ETERNAL SCARS"',
    images: [{ src: 'https://cdn.shopify.com/s/files/1/x/CD_MOCKUP.png?v=123' }],
    variants: [{ price: '15.00', price_currency: 'EUR', available: true }],
  },
  {
    handle: 'preorder-vinyl-eternal-scars',
    title: 'PREORDER - VINYL - "ETERNAL SCARS" SPLATTER GOLD/BLACK LIMITED',
    images: [{ src: 'https://cdn.shopify.com/s/files/1/x/VINYL.png?v=456' }],
    variants: [
      { price: '40.00', price_currency: 'EUR', available: false },
      { price: '35.00', price_currency: 'EUR', available: true },
    ],
  },
  {
    handle: 'parasite-t-shirt',
    title: 'PARASITE - T-SHIRT',
    images: [{ src: 'https://cdn.shopify.com/s/files/1/x/PARASITE.jpg?v=789' }],
    variants: [{ price: '20.00', price_currency: 'EUR', available: true }],
  },
]

describe('toCatalogue', () => {
  it('returns the full catalogue in storefront order', () => {
    const { all } = toCatalogue(products)

    expect(all.map((p) => p.handle)).toEqual([
      'preorder-cd-eternal-scars',
      'preorder-vinyl-eternal-scars',
      'parasite-t-shirt',
    ])
  })

  it('filters the preorder slice out of the same list', () => {
    const { preorder } = toCatalogue(products)

    expect(preorder.map((p) => p.handle)).toEqual([
      'preorder-cd-eternal-scars',
      'preorder-vinyl-eternal-scars',
    ])
  })

  it('keeps preorder items in "all" too — All means all', () => {
    const { all } = toCatalogue(products)

    expect(all.some((p) => p.handle === 'preorder-cd-eternal-scars')).toBe(true)
    expect(all).toHaveLength(3)
  })

  it('survives an empty payload', () => {
    expect(toCatalogue([])).toEqual({ preorder: [], all: [] })
  })
})

describe('toShopProduct', () => {
  it('deep-links the product detail page, never the store root', () => {
    const p = toShopProduct(products[0])

    expect(p.url).toBe(`${STORE_URL}products/preorder-cd-eternal-scars`)
    expect(p.url).not.toBe(STORE_URL)
  })

  it('prices from the cheapest variant', () => {
    const p = toShopProduct(products[1])

    // 35.00 (cheapest), not the 40.00 first variant.
    expect(p.price.replace(/ |\s/g, ' ')).toBe('35,00 €')
  })

  it('reports availability if any variant is available', () => {
    expect(toShopProduct(products[1]).available).toBe(true)
    expect(
      toShopProduct({ ...products[0], variants: [{ price: '15.00', available: false }] })
        .available,
    ).toBe(false)
  })

  it('tolerates a product with no image', () => {
    expect(toShopProduct({ ...products[0], images: [] }).image).toBeNull()
  })
})

describe('displayTitle', () => {
  it('strips the redundant PREORDER prefix — the section heading says it', () => {
    expect(displayTitle('PREORDER - DIGIPACK - "ETERNAL SCARS"')).toBe(
      'DIGIPACK - "ETERNAL SCARS"',
    )
    expect(displayTitle('PREORDER - MOUTHGUARD')).toBe('MOUTHGUARD')
  })

  it('handles the unhyphenated and lowercase spellings', () => {
    expect(displayTitle('Pre-order — Vinyl')).toBe('Vinyl')
    expect(displayTitle('preorder: Poster')).toBe('Poster')
  })

  it('leaves a non-preorder title alone', () => {
    expect(displayTitle('PARASITE - T-SHIRT')).toBe('PARASITE - T-SHIRT')
  })

  it('never strips a mid-title occurrence', () => {
    expect(displayTitle('BUNDLE - PREORDER PACK')).toBe('BUNDLE - PREORDER PACK')
  })

  it('normalises curly quotes', () => {
    expect(displayTitle('VINYL “ETERNAL SCARS”')).toBe('VINYL "ETERNAL SCARS"')
  })
})

describe('isPreorderProduct', () => {
  it('flags by handle prefix', () => {
    expect(isPreorderProduct({ handle: 'preorder-mouthguard', title: 'Mouthguard' })).toBe(true)
  })

  it('flags by title prefix even when the handle does not say so', () => {
    expect(isPreorderProduct({ handle: 'cd-eternal-scars', title: 'PREORDER - CD' })).toBe(true)
  })

  it('does not flag a regular product', () => {
    expect(isPreorderProduct({ handle: 'parasite-t-shirt', title: 'PARASITE - T-SHIRT' })).toBe(
      false,
    )
  })

  it('does not flag a mid-string match', () => {
    expect(isPreorderProduct({ handle: 'bundle-preorder', title: 'BUNDLE PREORDER' })).toBe(false)
  })
})

describe('currency', () => {
  // The live bug: the Vercel build fetched from a US region, Shopify returned
  // 18.00 USD (~15 EUR converted), and the hardcoded EUR formatter rendered it
  // as "18,00 €". Currency must come from the payload, never be assumed.
  it('labels a USD payload in USD, never in euros', () => {
    const p = toShopProduct({
      ...products[0],
      variants: [{ price: '18.00', price_currency: 'USD', available: true }],
    })

    expect(p.price).not.toContain('€')
    expect(p.price).toMatch(/\$|USD/)
  })

  it('honours a zero-decimal currency', () => {
    const p = toShopProduct({
      ...products[0],
      variants: [{ price: '2900', price_currency: 'JPY', available: true }],
    })

    expect(p.price).not.toContain(',00')
  })

  it('assumes EUR only when the field is absent, matching the pinned market', () => {
    const p = toShopProduct({
      ...products[0],
      variants: [{ price: '15.00', available: true }],
    })

    expect(p.price).toContain('€')
  })

  it('shows a bare number rather than a wrong symbol for a bad currency code', () => {
    const p = toShopProduct({
      ...products[0],
      variants: [{ price: '15.00', price_currency: 'NOTACURRENCY', available: true }],
    })

    expect(p.price).toBe('15')
    expect(p.price).not.toContain('€')
  })
})

describe('productsEndpoint', () => {
  // Regression: without an explicit country, products.json prices against the
  // requesting IP's market — amount AND currency. The Vercel build (US region)
  // received 18.00 USD for a product the FR store sells at 15,00 EUR.
  it('pins the market so prices do not depend on the build region', () => {
    expect(productsEndpoint()).toContain('country=FR')
  })

  it('requests the store-wide product list', () => {
    const url = new URL(productsEndpoint())
    expect(url.origin + url.pathname).toBe(`${STORE_URL}products.json`)
    expect(url.searchParams.get('limit')).toBe('250')
  })
})

describe('sized', () => {
  it('asks the Shopify CDN for a 2x width, preserving the cache key', () => {
    const out = sized('https://cdn.shopify.com/s/files/1/x/CD.png?v=123')

    expect(out).toContain('width=800')
    expect(out).toContain('v=123')
  })

  it('returns unparseable input unchanged', () => {
    expect(sized('not a url')).toBe('not a url')
  })
})
