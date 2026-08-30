import type { ReactNode } from 'react'

// Owns the site's vertical rhythm and heading hierarchy, so pages stop
// inventing their own. Before this, section spacing was gap-12 on Home,
// mt-10 on Discography, gap-8 on Contact and nothing elsewhere, with
// mt-2/mt-4/mt-6 used interchangeably for heading -> body.
//
// The whole system is three constants:
//   PAGE_STACK  — space between sibling sections
//   h1          — one per page, text-4xl
//   h2          — section headings, text-2xl (never the same size as the h1)
// and a fixed mt-4 from any heading to its body.

/** Wrap a page's sibling <Section>s in this to get consistent section spacing. */
export const PAGE_STACK = 'flex flex-col gap-16'

const HEADING = {
  h1: 'font-display text-4xl uppercase text-white',
  h2: 'font-display text-2xl uppercase text-white',
} as const

/** A page's single h1, for pages whose title has no body of its own. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className={HEADING.h1}>{children}</h1>
}

export default function Section({
  title,
  as = 'h2',
  surface = false,
  children,
}: {
  title: string
  /** Use 'h1' for the page's single top-level heading. */
  as?: 'h1' | 'h2'
  /** Render as a recessed panel — use when a page has several sibling sections. */
  surface?: boolean
  children: ReactNode
}) {
  const Heading = as

  return (
    <section
      className={
        surface
          ? 'border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6'
          : undefined
      }
    >
      <Heading className={HEADING[as]}>{title}</Heading>
      <div className="mt-4">{children}</div>
    </section>
  )
}
