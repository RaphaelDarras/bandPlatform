import { useState, type ReactNode } from 'react'

// Full-viewport video hero, modelled on the reference site's full-height
// deferred-media banner.
//
// "Deferred" is the important part: the YouTube iframe is NOT in the document
// until the visitor presses play. Before that it is a poster image and a
// button, so the page costs nothing extra to load and youtube-nocookie sets
// nothing (Pitfall 6). On play the iframe replaces the poster with autoplay.
export default function FullscreenPlayer({
  videoId,
  poster,
  posterWide,
  title,
  eyebrow,
  action,
}: {
  videoId: string
  /** Narrow/phone poster. */
  poster: string
  /** Wide poster used from 640px up. */
  posterWide?: string
  title: string
  eyebrow?: string
  /** Optional secondary CTA rendered beside the play button. */
  action?: ReactNode
}) {
  const [playing, setPlaying] = useState(false)

  return (
    <section
      className="full-bleed relative flex items-end overflow-hidden bg-[#0b0b0b]"
      // svh so mobile browser chrome doesn't crop the hero.
      style={{ height: '100svh' }}
      aria-label={title}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&playsinline=1`}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      ) : (
        <>
          <picture>
            <source media="(min-width: 640px)" srcSet={posterWide ?? poster} />
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          {/* Scrim: keeps the overlaid type legible over any artwork and gives
              the bottom edge somewhere to sit. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/35 to-transparent"
          />

          <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 sm:pb-24">
            {eyebrow && (
              <div className="type-label mb-4 flex items-center gap-3 text-[var(--color-accent)]">
                <span aria-hidden="true" className="h-px w-10 bg-[var(--color-accent)]" />
                {eyebrow}
              </div>
            )}
            <h1 className="type-display text-[var(--color-ink)]">{title}</h1>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="type-label inline-flex items-center gap-4 bg-[var(--color-ink)] px-8 py-4 text-[#141414] transition-colors duration-200 hover:bg-[var(--color-accent)]"
              >
                <svg
                  width="14"
                  height="16"
                  viewBox="0 0 14 16"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  <path d="M0 0l14 8-14 8z" />
                </svg>
                Play video
              </button>
              {action}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
