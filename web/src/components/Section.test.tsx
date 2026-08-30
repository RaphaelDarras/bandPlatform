import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Section, { PageTitle, PAGE_STACK } from './Section'

describe('Section', () => {
  it('defaults to an h2 and renders its title', () => {
    render(<Section title="Latest Release">body</Section>)

    const heading = screen.getByRole('heading', { name: 'Latest Release' })
    expect(heading.tagName).toBe('H2')
  })

  it('renders an h1 when asked, on a larger type step than the h2', () => {
    const { container: one } = render(<Section title="About" as="h1">body</Section>)
    const { container: two } = render(<Section title="About" as="h2">body</Section>)

    // Fluid clamp scale lives in styles.css; the components only pick a step.
    expect(one.querySelector('h1')!.className).toContain('type-h1')
    expect(two.querySelector('h2')!.className).toContain('type-h2')
  })

  it('keeps a single fixed heading-to-body gap', () => {
    const { container } = render(<Section title="Next Show">body</Section>)

    expect(container.querySelector('h2 + div')!.className).toBe('mt-5')
  })

  it('is transparent by default and a panel when surface is set', () => {
    const { container: plain } = render(<Section title="A">body</Section>)
    const { container: panel } = render(
      <Section title="A" surface>
        body
      </Section>,
    )

    expect(plain.querySelector('section')!.className).toBe('')
    expect(panel.querySelector('section')!.className).toContain('panel')
  })

  it('opens with the heading — nothing is rendered above it', () => {
    const { container } = render(<Section title="Preorder">body</Section>)

    const section = container.querySelector('section')!
    expect(section.firstElementChild!.tagName).toBe('H2')
    expect(section.children).toHaveLength(2) // heading + body, nothing else
    // About (D-22/D-23) must contain exactly one <p>, so Section itself adds none.
    expect(container.querySelectorAll('p')).toHaveLength(0)
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
