import Section from '../components/Section'

// About (WEB-01, D-22/D-23): a single short paragraph, no lineup/member
// section. Hand-authored placeholder prose — edit freely, keep to one
// paragraph. Spacing and heading size come from <Section>.
export function Component() {
  return (
    <Section title="About" as="h1">
      <p className="type-body text-[var(--color-ink-dim)]">
        Hurakan is a French metal band forged out of a shared love for heavy
        riffs, cinematic atmosphere, and unapologetic energy. Since forming,
        the band has written, recorded, and performed original music that
        balances crushing low end with melodic hooks, building a growing
        catalog of singles and a reputation for intense live shows.
      </p>
    </Section>
  )
}

export default Component
