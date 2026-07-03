import { releases } from '../data/releases'
import ReleaseItem from '../components/ReleaseItem'

// Discography route (WEB-02). Maps the hand-authored releases[] config into
// one embed per entry, in array order (D-21), with no metadata (D-20).
export function Component() {
  return (
    <section>
      <h1 className="font-display text-3xl uppercase text-white">Discography</h1>
      <div className="mt-4 flex flex-col gap-6">
        {releases.map((r, i) => (
          <ReleaseItem key={i} release={r} />
        ))}
      </div>
    </section>
  )
}

export default Component
