import Button from '../components/Button'

// 404 catch-all (UI-SPEC copywriting contract). Keeps its oversized h1 — this
// page has no sections to rank against, so the display size is the whole point.
export function Component() {
  return (
    <section className="py-16 text-center">
      <h1 className="font-display text-5xl uppercase text-white">Page not found</h1>
      <p className="mt-2 font-sans text-white/75">
        This page doesn&apos;t exist. Head back to the homepage.
      </p>
      <div className="mt-6">
        <Button to="/">Back to Home</Button>
      </div>
    </section>
  )
}

export default Component
