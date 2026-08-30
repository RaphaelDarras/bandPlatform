import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

// Main navigation is Home / Shop / Listen / Concerts (D-20/D-24). About
// and Contact live in the footer. Desktop shows the full nav inline; mobile
// uses a hamburger toggle (D-27). Toggle button is a 44x44 tap target.
//
// The bar is translucent + blurred so the page scrolls beneath it, and it only
// grows a border and background once you leave the top — at rest it sits over
// the hero banner invisibly.

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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Active link gets gold text plus a gold rule beneath it; the rule is
  // always rendered and scaled to 0 so it can animate in on hover too.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'type-label group relative py-1 transition-colors duration-200',
      isActive
        ? 'text-[var(--color-accent)]'
        : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]',
    ].join(' ')

  const rule = (isActive: boolean) =>
    [
      'pointer-events-none absolute -bottom-0.5 left-0 h-px w-full origin-left',
      'bg-[var(--color-accent)] transition-transform duration-300 motion-reduce:transition-none',
      isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
    ].join(' ')

  return (
    <header
      className={[
        'sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        'border-b',
        scrolled
          ? 'border-[var(--color-hairline)] bg-[rgba(15,15,15,0.72)] backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      ].join(' ')}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <NavLink to="/" end className="group flex items-center gap-2.5">
          <img
            src="/images/HURAKAN_ICON.png"
            alt=""
            width={96}
            height={96}
            className="h-8 w-8 rounded-full ring-1 ring-[var(--color-hairline)]"
          />
          <span className="type-h2 text-[var(--color-ink)] transition-colors duration-200 group-hover:text-[var(--color-accent)]">
            Hurakan
          </span>
        </NavLink>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-9 md:flex">
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
                  <span aria-hidden="true" className={rule(false)} />
                </a>
              ) : (
                <NavLink to={l.to} end={l.end} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      {l.label}
                      <span aria-hidden="true" className={rule(isActive)} />
                    </>
                  )}
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-ink)] transition-colors hover:bg-[rgba(245,234,205,0.06)] md:hidden"
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
        <ul className="flex flex-col border-t border-[var(--color-hairline)] bg-[rgba(15,15,15,0.96)] px-5 py-2 backdrop-blur-xl md:hidden">
          {NAV_LINKS.map((l) => {
            const mobileClass = (isActive: boolean) =>
              [
                'type-label flex min-h-11 items-center transition-colors',
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]',
              ].join(' ')
            return (
              <li key={l.label} className="border-b border-[var(--color-hairline)] last:border-b-0">
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
