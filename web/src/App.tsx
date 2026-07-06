import type { RouteRecord } from 'vite-react-ssg'
import Layout from './components/Layout'
import { fetchUpcomingEvents } from './lib/bandsintown'

// Build-time loader shared by Home (next-show teaser) and Concerts (full list).
// Runs only during `vite-react-ssg build`; the result is baked into static HTML.
const eventsLoader = async () => ({ events: await fetchUpcomingEvents() })

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, lazy: () => import('./pages/Home'), loader: eventsLoader },
      { path: 'discography', lazy: () => import('./pages/Discography') },
      { path: 'concerts', lazy: () => import('./pages/Concerts'), loader: eventsLoader },
      { path: 'about', lazy: () => import('./pages/About') },
      { path: 'contact', lazy: () => import('./pages/Contact') },
      { path: 'stock', lazy: () => import('./pages/Stock') },
      { path: 'shop', lazy: () => import('./pages/Shop') },
      // No loader/getStaticPaths — deliberately excluded from the static
      // prerender (D-06). Stock is live data and must never be baked into
      // static HTML; direct-link/refresh is served via the vercel.json
      // scoped rewrite instead.
      { path: 'shop/:id', lazy: () => import('./pages/ShopDetail') },
      { path: 'cart', lazy: () => import('./pages/Cart') },
      { path: 'checkout', lazy: () => import('./pages/Checkout') },
      // No loader/getStaticPaths — deliberately excluded from the static
      // prerender (D-06), same runtime-only convention as shop/:id above.
      // These three are post-payment/return destinations that only make
      // sense navigated to at runtime after a live checkout attempt.
      { path: 'checkout/success', lazy: () => import('./pages/CheckoutSuccess') },
      { path: 'checkout/cancel', lazy: () => import('./pages/CheckoutCancel') },
      { path: 'checkout/paypal-return', lazy: () => import('./pages/PaypalReturn') },
      { path: '*', lazy: () => import('./pages/NotFound') },
    ],
  },
]
