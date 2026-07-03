// Contact (WEB-04, D-13/D-14/D-16): static contact info only, no form.
// Two channels (general + booking) with placeholder addresses — real values
// land in Wave 1 (Plan 04-04).
export function Component() {
  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Contact</h1>
      <ul className="mt-4 flex flex-col gap-2 font-sans text-white/75">
        <li>
          General:{' '}
          <a href="mailto:hi@hurakanband.fr" rel="noopener" className="underline">
            hi@hurakanband.fr
          </a>
        </li>
        <li>
          Booking / Press:{' '}
          <a href="mailto:booking@hurakanband.fr" rel="noopener" className="underline">
            booking@hurakanband.fr
          </a>
        </li>
        <li>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Instagram
          </a>
        </li>
      </ul>
    </section>
  )
}

export default Component
