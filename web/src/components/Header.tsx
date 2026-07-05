import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useCartStore } from '../lib/cartStore'

// Main navigation is Home / Discography / Concerts / Shop (D-20/D-24). About
// and Contact live in the footer. Desktop shows the full nav inline; mobile
// uses a hamburger toggle (D-27). Toggle button is a 44x44 tap target
// (UI-SPEC). A persistent cart icon + item-count badge (D-21) sits outside
// the md:hidden hamburger gate so it shows on desktop AND mobile.

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/discography', label: 'Discography', end: false },
  { to: '/concerts', label: 'Concerts', end: false },
  { to: '/shop', label: 'Shop', end: false },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const itemCount = useCartStore((state) =>
    state.lines.reduce((sum, l) => sum + l.quantity, 0),
  )

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'font-sans text-sm font-semibold uppercase tracking-[0.06em]',
      isActive ? 'text-[var(--color-accent)]' : 'text-white/75 hover:text-white',
    ].join(' ')

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-hairline)] bg-[var(--color-surface)]">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <NavLink to="/" end className="flex items-center gap-2">
          <img
            src="/images/HURAKAN_SLAM_ICON_inverted.png"
            alt="Hurakan"
            className="h-8 w-8"
          />
          <span className="font-display text-2xl uppercase tracking-wide text-[var(--color-accent)]">
            Hurakan
          </span>
        </NavLink>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center">
          {/* Persistent cart icon (D-21) — visible on desktop AND mobile,
              not gated behind the hamburger. */}
          <Link
            to="/cart"
            aria-label={itemCount > 0 ? `Cart, ${itemCount} items` : 'Cart'}
            className="relative flex h-11 w-11 items-center justify-center text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h2l1.5 10.5A2 2 0 0 0 9.48 19h7.04a2 2 0 0 0 1.98-1.5L20 9H6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9.5" cy="21.5" r="1" fill="currentColor" />
              <circle cx="17.5" cy="21.5" r="1" fill="currentColor" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 font-sans text-[11px] font-semibold text-black">
                {itemCount}
              </span>
            )}
          </Link>

          {/* Mobile hamburger toggle (44x44 tap target) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center text-white md:hidden"
          >
            {open ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {open && (
        <ul className="flex flex-col gap-1 border-t border-[var(--color-hairline)] px-4 py-2 md:hidden">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex min-h-11 items-center font-sans text-sm font-semibold uppercase tracking-[0.06em]',
                    isActive ? 'text-[var(--color-accent)]' : 'text-white/75',
                  ].join(' ')
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
