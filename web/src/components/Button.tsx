import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

// Single source of truth for the site's CTA treatments.
//
// Renders a router <Link> when given `to`, an external <a> when given `href`
// (target/rel applied automatically), otherwise a plain <button>.

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

const BASE =
  'type-label inline-flex items-center justify-center gap-2 rounded-full ' +
  'transition-[transform,background-color,border-color,color,box-shadow] duration-200 ' +
  'motion-reduce:transition-none'

const VARIANTS: Record<ButtonVariant, string> = {
  // Filled gold. One per section — this is the page's ask.
  primary:
    'bg-[var(--color-accent)] px-7 py-3.5 text-[#141414] ' +
    'shadow-[0_8px_24px_-10px_rgba(200,188,134,0.55)] ' +
    'hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(200,188,134,0.7)] ' +
    'motion-reduce:hover:translate-y-0',
  // Steel outline — the cold accent, so it reads as clearly subordinate to
  // gold rather than competing with it.
  secondary:
    'border border-[var(--color-steel)] px-7 py-3.5 text-[var(--color-ink)] ' +
    'hover:border-[var(--color-ink)] hover:bg-[rgba(94,127,133,0.16)]',
  // Inline text link — navigational, not an action.
  quiet:
    'text-[var(--color-ink-dim)] underline decoration-[var(--color-steel)] decoration-2 ' +
    'underline-offset-4 hover:text-[var(--color-ink)] hover:decoration-[var(--color-accent)]',
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
