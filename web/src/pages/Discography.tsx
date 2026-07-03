import { releases } from '../data/releases'

// Discography (WEB-02). Renders the hand-authored releases[] in order.
// Full Spotify/YouTube embed components land in Wave 1 (Plan 04-03) — this
// stub proves the data contract and route prerender.
export function Component() {
  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Discography</h1>
      <ul className="mt-4 flex flex-col gap-3">
        {releases.map((r, i) => (
          <li
            key={i}
            className="border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4 font-sans text-sm text-white/75"
          >
            {r.kind === 'spotify'
              ? `Spotify ${r.embedType}: ${r.id}`
              : `YouTube: ${r.videoId}`}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Component
