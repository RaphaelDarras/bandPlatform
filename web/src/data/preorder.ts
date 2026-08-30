// Hand-authored list of the preorder products the home page features, in
// display order — same philosophy as releases.ts (D-18/D-19): the config names
// what to show, Shopify supplies the live image, price and availability.
//
// `handle` is the product's Shopify handle (the last path segment of its
// storefront URL). `label` is what the card shows, because the live titles are
// written for the store, not for a teaser:
//   PREORDER - VINYL - "ETERNAL SCARS" SPLATTER GOLD/BLACK LIMITED
//
// Add a product = add one line. Remove it from Shopify and it drops off the
// site on the next build automatically (selectFeatured skips unknown handles).
//
// The store also carries preorder apparel, a poster, a mouthguard and four
// bundle packs (JAB / CROSS / HOOK / UPPERCUT). Those are deliberately not
// featured here — this section is the album itself. The "all preorder items"
// link at the bottom of the section covers the rest.

import type { FeaturedHandle } from '../lib/shopify'

export const FEATURED_PREORDERS: FeaturedHandle[] = [
  { handle: 'preorder-cd-eternal-scars', label: 'Digipack CD' },
  { handle: 'preorder-vinyl-eternal-scars-black', label: 'Vinyl — Black' },
  { handle: 'preorder-vinyl-eternal-scars', label: 'Vinyl — Splatter Gold/Black' },
]
