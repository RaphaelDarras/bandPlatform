import { useState } from 'react'
import { Head } from 'vite-react-ssg'
import { resetVotes } from '../lib/votes'

export function Component() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onReset() {
    if (busy || !window.confirm('Sûr ? Tous les votes seront effacés.')) return
    setBusy(true)
    setMessage(null)
    try {
      await resetVotes()
      setMessage('Votes remis à zéro.')
    } catch {
      setMessage("La remise à zéro a échoué. Réessaie.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 px-6 py-16 text-center">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 className="type-h1">Reset des votes</h1>
      <button
        type="button"
        onClick={onReset}
        disabled={busy}
        className="type-label bg-[var(--color-accent)] px-6 py-4 text-[var(--color-on-accent)] disabled:opacity-40"
      >
        Remettre à zéro
      </button>
      {message && (
        <p className="type-body" role="status">
          {message}
        </p>
      )}
    </section>
  )
}

export default Component
