import type { ReactNode } from 'react'

// Owns the site's vertical rhythm and heading hierarchy, so pages stop
// inventing their own.
//
// The system is:
//   PAGE_STACK  — space between sibling sections (fluid: tighter on phones)
//   h1          — one per page, .type-h1
//   h2          — section headings, .type-h2
// and a fixed mt-5 from the heading to its body. A section is its heading and
// its content — nothing sits above the heading.

/** Wrap a page's sibling <Section>s in this to get consistent section spacing. */
export const PAGE_STACK = 'flex flex-col gap-16 sm:gap-24'

export default function Section({
  title,
  as = 'h2',
  surface = false,
  children,
}: {
  title: string
  /** Use 'h1' for the page's single top-level heading. */
  as?: 'h1' | 'h2'
  /** Render as a panel — use when a page has several sibling sections. */
  surface?: boolean
  children: ReactNode
}) {
  const Heading = as

  return (
    <section className={surface ? 'panel p-6 sm:p-8' : undefined}>
      <Heading className={`${as === 'h1' ? 'type-h1' : 'type-h2'} text-[var(--color-ink)]`}>
        {title}
      </Heading>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** A page's single h1, for pages whose title has no body of its own. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="type-h1 text-[var(--color-ink)]">{children}</h1>
}
