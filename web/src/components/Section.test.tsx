import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Section, { PageTitle, PAGE_STACK } from './Section'

describe('Section', () => {
  it('defaults to an h2 and renders its title', () => {
    render(<Section title="Latest Release">body</Section>)

    const heading = screen.getByRole('heading', { name: 'Latest Release' })
    expect(heading.tagName).toBe('H2')
  })

  it('renders an h1 when asked, at a larger size than the h2', () => {
    const { container: one } = render(<Section title="About" as="h1">body</Section>)
    const { container: two } = render(<Section title="About" as="h2">body</Section>)

    expect(one.querySelector('h1')!.className).toContain('text-4xl')
    expect(two.querySelector('h2')!.className).toContain('text-2xl')
  })

  it('keeps a single fixed heading-to-body gap', () => {
    const { container } = render(<Section title="Next Show">body</Section>)

    expect(container.querySelector('h2 + div')!.className).toBe('mt-4')
  })

  it('is transparent by default and a recessed panel when surface is set', () => {
    const { container: plain } = render(<Section title="A">body</Section>)
    const { container: panel } = render(
      <Section title="A" surface>
        body
      </Section>,
    )

    expect(plain.querySelector('section')!.className).toBe('')
    expect(panel.querySelector('section')!.className).toContain('bg-[var(--color-surface)]')
    expect(panel.querySelector('section')!.className).toContain('border')
  })

  it('PageTitle renders an h1 matching the Section h1 style', () => {
    const { container: title } = render(<PageTitle>Contact</PageTitle>)
    const { container: section } = render(<Section title="Contact" as="h1">body</Section>)

    expect(title.querySelector('h1')!.className).toBe(section.querySelector('h1')!.className)
  })

  it('exposes one section gap for pages to share', () => {
    expect(PAGE_STACK).toContain('gap-16')
  })
})
