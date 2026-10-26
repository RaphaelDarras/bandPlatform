import { useEffect, useState } from 'react'
import { Head } from 'vite-react-ssg'
import BeerBottle from '../components/BeerBottle'
import { VOTE_CHOICES, computeFillLevels, fetchVotes, type VoteTally } from '../lib/votes'

const POLL_MS = 4000

export function Component() {
  const [tally, setTally] = useState<VoteTally | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const t = await fetchVotes()
        if (!cancelled) {
          setTally(t)
          setFailed(false)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void load()
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const fills = computeFillLevels(tally?.counts ?? {})

  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-10 px-6 py-16 text-center">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 className="type-h1">Résultats</h1>
      {!tally ? (
        <p className="type-body">{failed ? 'Impossible de charger les résultats.' : 'Chargement…'}</p>
      ) : (
        <>
          <div className="grid w-full grid-cols-2 gap-8 md:grid-cols-4">
            {VOTE_CHOICES.map((c) => (
              <div key={c.id} className="flex flex-col items-center gap-3">
                <BeerBottle fill={fills[c.id]} label={c.label} />
                <h2 className="type-h3">{c.label}</h2>
                <p className="type-body text-[var(--color-ink-dim)]">{c.description}</p>
                <p className="font-display text-3xl">{tally.counts[c.id] ?? 0} votes</p>
              </div>
            ))}
          </div>
          <p className="type-body">Total : {tally.total} votes</p>
          {failed && (
            <p className="type-body text-[var(--color-ink-dim)]">Actualisation impossible, nouvel essai…</p>
          )}
        </>
      )}
    </section>
  )
}

export default Component
