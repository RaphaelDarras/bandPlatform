import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

// Single source of truth for the site's CTA treatments.
//
// Renders a router <Link> when given `to`, an external <a> when given `href`
// (target/rel applied automatically), otherwise a plain <button>.

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

// Zero radius, per the reference site (--rounded-button: 0rem).
const BASE =
  'type-label inline-flex items-center justify-center gap-2 ' +
  'transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none'

const VARIANTS: Record<ButtonVariant, string> = {
  // Near-white fill with near-black text, like the reference's
  // --color-base-button 225/225/225 on --color-button-text 0/0/0. Ivory rather
  // than pure white keeps it in the Dogma palette.
  primary:
    'bg-[var(--color-ink)] px-8 py-4 text-[#141414] hover:bg-[var(--color-accent)]',
  // Hard-edged outline in steel.
  secondary:
    'border border-[var(--color-steel)] px-8 py-4 text-[var(--color-ink)] ' +
    'hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[#141414]',
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
