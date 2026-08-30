import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import { pingHealth } from '../lib/products'

// Page shell: Header + routed content + Footer.
//
//
// Layout is the one component mounted on every route, so it's the single
// place that fires the D-10 keep-alive /health ping to warm the Render
// free-tier instance the moment any visitor lands on any page.
export default function Layout() {
  useEffect(() => {
    pingHealth()
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--color-bg)]">
      {/* Keyboard/screen-reader users can jump the nav — there was no way past
          it before. Visually hidden until focused. */}
      <a
        href="#main"
        className="type-label sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:z-[60] focus:bg-[var(--color-accent)] focus:px-5 focus:py-3 focus:text-[var(--color-on-accent)]"
      >
        Skip to content
      </a>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24 pt-10 sm:pt-14">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
