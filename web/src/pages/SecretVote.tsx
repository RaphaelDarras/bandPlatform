import { useEffect, useState } from 'react'
import { Head } from 'vite-react-ssg'
import { VOTE_CHOICES, VOTED_STORAGE_KEY, castVote, type VoteChoiceId } from '../lib/votes'

export function Component() {
  const [selected, setSelected] = useState<VoteChoiceId | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // localStorage only inside an effect: the page is prerendered (SSG).
  // The flag is a courtesy duplicate guard, not security.
  useEffect(() => {
    try {
      if (localStorage.getItem(VOTED_STORAGE_KEY)) setDone(true)
    } catch {
      // storage unavailable
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await castVote(selected)
      try {
        localStorage.setItem(VOTED_STORAGE_KEY, '1')
      } catch {
        // ignore
      }
      setDone(true)
    } catch {
      setError("Le vote n'a pas pu être enregistré. Réessaie.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 px-6 py-16 text-center">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 className="type-h1">Vote</h1>
      {done ? (
        <p className="type-body" role="status">
          Merci pour ton vote !
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Choisis une option</legend>
            {VOTE_CHOICES.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer flex-col gap-1 border px-5 py-4 ${
                  selected === c.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'border-[var(--color-hairline)]'
                }`}
              >
                <input
                  type="radio"
                  name="choice"
                  value={c.id}
                  checked={selected === c.id}
                  onChange={() => setSelected(c.id)}
                  aria-labelledby={`choice-${c.id}-name`}
                  aria-describedby={`choice-${c.id}-desc`}
                  className="sr-only"
                />
                <span id={`choice-${c.id}-name`} className="type-h3">
                  {c.label}
                </span>
                <span id={`choice-${c.id}-desc`} className="type-body">
                  {c.description}
                </span>
              </label>
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="type-body">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!selected || submitting}
            className="type-label bg-[var(--color-accent)] px-6 py-4 text-[var(--color-on-accent)] disabled:opacity-40"
          >
            Voter
          </button>
        </form>
      )}
    </section>
  )
}

export default Component
