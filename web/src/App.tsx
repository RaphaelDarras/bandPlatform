import type { RouteRecord } from 'vite-react-ssg'
import Layout from './components/Layout'
import { fetchUpcomingEvents } from './lib/bandsintown'
import { fetchCatalogue } from './lib/shopify'

// Build-time loader shared by Home (next-show teaser) and Concerts (full list).
// Runs only during `vite-react-ssg build`; the result is baked into static HTML.
const eventsLoader = async () => ({ events: await fetchUpcomingEvents() })

// Home additionally bakes in the whole Shopify catalogue, split into its
// preorder and full slices. Both fetches are independent, so they run
// concurrently and one failing soft never delays or blocks the other.
const homeLoader = async () => {
  const [events, catalogue] = await Promise.all([fetchUpcomingEvents(), fetchCatalogue()])
  return { events, catalogue }
}

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, lazy: () => import('./pages/Home'), loader: homeLoader },
      { path: 'listen', lazy: () => import('./pages/Discography') },
      { path: 'concerts', lazy: () => import('./pages/Concerts'), loader: eventsLoader },
      { path: 'about', lazy: () => import('./pages/About') },
      { path: 'contact', lazy: () => import('./pages/Contact') },
      // No loader/getStaticPaths — deliberately kept from baking live data
      // into the static prerender (D-06). Stock is live data and must never
      // be baked into static HTML; the shell prerenders and hydrates at runtime.
      { path: 'stock', lazy: () => import('./pages/Stock') },
      // The storefront moved to Shopify (shop.hurakanband.fr). The former
      // in-app commerce routes (/shop, /shop/:id, /cart, /checkout and its
      // success/cancel/paypal-return pages) are intentionally unmounted; their
      // page components remain in the tree but are now unreferenced dead code,
      // along with the /shop/(.*) vercel rewrite that used to front them.
      { path: '*', lazy: () => import('./pages/NotFound') },
    ],
  },
]
