// Contact (WEB-04, D-13/D-14/D-16): static contact info only, no form, no
// backend. One email channel plus the band's external channels — Instagram,
// Spotify, and the Shopify storefront (matches the footer).
export function Component() {
  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Contact</h1>

      <div className="mt-6 flex flex-col gap-8">
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
            Email
          </h2>
          <p className="mt-2 font-sans text-white/75">
            <a href="mailto:hurakanband@gmail.com" rel="noopener" className="underline">
              hurakanband@gmail.com
            </a>
          </p>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white">
            Follow
          </h2>
          <ul className="mt-2 flex flex-col gap-2 font-sans text-white/75">
            <li>
              <a
                href="https://www.instagram.com/hurakanband/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href="https://www.tiktok.com/@hurakanband"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                TikTok
              </a>
            </li>
            <li>
              <a
                href="https://open.spotify.com/artist/5w35Gt5153qhoSwR4MVtEU"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Spotify
              </a>
            </li>
            <li>
              <a
                href="https://shop.hurakanband.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Shop
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Component
