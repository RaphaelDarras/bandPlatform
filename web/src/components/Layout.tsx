import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import { useCartStore } from '../lib/cartStore'
import { pingHealth } from '../lib/products'

// Page shell: Header + routed content + Footer on a full-black background.
// Layout is the one component mounted on every route, so it's the single
// place that (1) rehydrates the persisted cart from localStorage exactly
// once, client-side, after mount — never during the SSG build pass, per
// D-12's "read localStorage only after mount" rule — and (2) fires the D-10
// keep-alive /health ping to warm the Render free-tier instance the moment
// any visitor lands on any page.
export default function Layout() {
  useEffect(() => {
    useCartStore.persist.rehydrate()
    useCartStore.getState().setHasHydrated(true)
    pingHealth()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
