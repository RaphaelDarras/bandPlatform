import { Link } from 'react-router-dom'

// Present on every page via Layout. Links to /about and /contact (footer-only
// routes, D-15/D-24) plus external Email/Instagram/Bandsintown channels
// (D-14; two contact channels per D-16 — placeholders fleshed out in Plan
// 04-04). Each row is a >=44px tap target (UI-SPEC).

const rowClass =
  'flex min-h-11 items-center font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white/75 hover:text-white'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-hairline)] bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:grid-cols-2">
        <nav aria-label="Secondary" className="flex flex-col">
          <Link to="/about" className={rowClass}>
            About
          </Link>
          <Link to="/contact" className={rowClass}>
            Contact
          </Link>
        </nav>

        <nav aria-label="Social and contact" className="flex flex-col">
          {/* Placeholder addresses — real values land in Plan 04-04 (D-16) */}
          <a
            href="mailto:hi@hurakanband.fr"
            rel="noopener"
            className={rowClass}
          >
            Email
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={rowClass}
          >
            Instagram
          </a>
          <a
            href="https://www.bandsintown.com/a/433176"
            target="_blank"
            rel="noopener noreferrer"
            className={rowClass}
          >
            Bandsintown
          </a>
        </nav>
      </div>
    </footer>
  )
}
