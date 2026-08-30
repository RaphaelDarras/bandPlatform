// Full-bleed hero player: the release itself, edge to edge, shown directly.
//
// No poster, no overlay, no play button — the player is the hero. 16:9 is kept
// so the video fills its frame exactly rather than sitting inside black bars,
// which on a wide screen works out to very nearly the full viewport.
//
// Trade-off of showing it directly: the youtube-nocookie iframe now loads on
// every home-page view instead of only on click. nocookie still means no
// third-party cookie is set until the visitor actually presses play.
export default function FullscreenPlayer({
  videoId,
  title,
}: {
  videoId: string
  /** Used for the iframe title and the page's h1. */
  title: string
}) {
  return (
    <section className="full-bleed bg-[var(--color-bg)]" aria-label={title}>
      {/* The banner artwork is no longer shown here, so the wordmark only
          exists as text — keep it a real h1 for SEO and screen readers. */}
      <h1 className="sr-only">{title}</h1>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`}
        className="block aspect-video h-auto w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title}
      />
    </section>
  )
}
