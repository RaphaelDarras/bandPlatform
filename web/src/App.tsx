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
      { path: '*', lazy: () => import('./pages/NotFound') },
    ],
  },
]
