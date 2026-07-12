import { useState } from 'react'
import { NavLink } from 'react-router-dom'

// Main navigation is Home / Shop / Listen / Concerts (D-20/D-24). About
// and Contact live in the footer. Desktop shows the full nav inline; mobile
// uses a hamburger toggle (D-27). Toggle button is a 44x44 tap target
// (UI-SPEC).

// The Shop lives on a separate Shopify storefront, so it opens in a new tab
// via an external href rather than an in-app route.
const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { href: 'https://shop.hurakanband.fr/', label: 'Shop' },
  { to: '/listen', label: 'Listen', end: false },
  { to: '/concerts', label: 'Concerts', end: false },
]

export default function Header() {
  const [open, setOpen] = useState(false)

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
            src="/images/PP_RESEAUX.jpg"
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
            <li key={l.label}>
              {'href' in l ? (
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass({ isActive: false })}
                >
                  {l.label}
                </a>
              ) : (
                <NavLink to={l.to} end={l.end} className={linkClass}>
                  {l.label}
                </NavLink>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center">
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
          {NAV_LINKS.map((l) => {
            const mobileClass = (isActive: boolean) =>
              [
                'flex min-h-11 items-center font-sans text-sm font-semibold uppercase tracking-[0.06em]',
                isActive ? 'text-[var(--color-accent)]' : 'text-white/75',
              ].join(' ')
            return (
              <li key={l.label}>
                {'href' in l ? (
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className={mobileClass(false)}
                  >
                    {l.label}
                  </a>
                ) : (
                  <NavLink
                    to={l.to}
                    end={l.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => mobileClass(isActive)}
                  >
                    {l.label}
                  </NavLink>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </header>
  )
}
