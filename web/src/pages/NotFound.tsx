import { Link } from 'react-router-dom'

// 404 catch-all (UI-SPEC copywriting contract).
export function Component() {
  return (
    <section className="py-16 text-center">
      <h1 className="font-display text-5xl uppercase text-white">Page not found</h1>
      <p className="mt-2 font-sans text-white/75">
        This page doesn&apos;t exist. Head back to the homepage.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black"
      >
        Back to Home
      </Link>
    </section>
  )
}

export default Component
