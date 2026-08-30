import Button from '../components/Button'

// 404 catch-all (UI-SPEC copywriting contract). Uses the largest type step —
// this page has no sections to rank against, so the display size is the point.
export function Component() {
  return (
    <section className="py-24 text-center">
      <h1 className="type-display text-[var(--color-ink)]">Page not found</h1>
      <p className="type-body mx-auto mt-4 text-[var(--color-ink-dim)]">
        This page doesn&apos;t exist. Head back to the homepage.
      </p>
      <div className="mt-8">
        <Button to="/">Back to Home</Button>
      </div>
    </section>
  )
}

export default Component
