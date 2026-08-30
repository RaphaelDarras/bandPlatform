import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

// Single source of truth for the site's CTA treatments. Replaces the four
// hand-inlined variants that had accumulated across Home/Concerts (filled
// px-6 py-3, outlined px-4 py-2, bold-uppercase-underline, plain underline).
//
// Renders a router <Link> when given `to`, an external <a> when given `href`
// (target/rel applied automatically), otherwise a plain <button>.

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

const BASE =
  'inline-block font-sans text-sm font-semibold uppercase tracking-[0.06em] transition-colors'

const VARIANTS: Record<ButtonVariant, string> = {
  // Filled accent — one per section, maximum one primary per viewport.
  primary: 'bg-[var(--color-accent)] px-6 py-3 text-black hover:opacity-85',
  // Outlined — secondary action sitting next to a primary.
  secondary:
    'border border-[var(--color-accent)] px-6 py-3 text-white hover:bg-[var(--color-accent)] hover:text-black',
  // Inline text link — navigational, not an action.
  quiet: 'text-white/75 underline hover:text-white',
}

type Props = {
  variant?: ButtonVariant
  /** Internal route — renders a react-router <Link>. */
  to?: string
  /** External URL — renders an <a target="_blank">. */
  href?: string
  onClick?: () => void
  className?: string
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  to,
  href,
  onClick,
  className,
  children,
}: Props) {
  const cls = [BASE, VARIANTS[variant], className].filter(Boolean).join(' ')

  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}
