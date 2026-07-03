// Contact (WEB-04, D-13/D-14/D-16): static contact info only, no form, no
// backend. Two clearly-separated channels — general fan contact and
// booking/press — plus Instagram and Bandsintown. Placeholder addresses are
// marked with TODO comments below; replace with the real addresses before
// launch (D-16 — placeholders decided intentionally, not invented copy).
export function Component() {
  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Contact</h1>

      <div className="mt-6 flex flex-col gap-8">
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
            General
          </h2>
          {/* TODO: replace with the real general fan-contact address */}
          <p className="mt-2 font-sans text-white/75">
            <a href="mailto:hi@hurakanband.fr" rel="noopener" className="underline">
              hi@hurakanband.fr
            </a>
          </p>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
            Booking / Press
          </h2>
          {/* TODO: replace with the real booking/press address */}
          <p className="mt-2 font-sans text-white/75">
            <a href="mailto:booking@hurakanband.fr" rel="noopener" className="underline">
              booking@hurakanband.fr
            </a>
          </p>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
            Follow
          </h2>
          <ul className="mt-2 flex flex-col gap-2 font-sans text-white/75">
            <li>
              {/* TODO: replace with the real Instagram handle URL */}
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href="https://www.bandsintown.com/a/433176"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Bandsintown
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Component
