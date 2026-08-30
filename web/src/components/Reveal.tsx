import { useEffect, useRef, useState, type ReactNode } from 'react'

// Scroll-reveal wrapper. Content is present in the DOM and in the prerendered
// HTML from the first byte — only opacity/transform are animated — so this
// costs nothing for SEO and never hides content from a crawler.
//
// Falls back to visible-immediately when IntersectionObserver is missing (and
// during the SSG render), and the CSS drops the animation entirely under
// prefers-reduced-motion.
export default function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode
  /** ms — stagger siblings by passing 60, 120, … */
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect() // reveal once; never animate back out
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="reveal"
      data-visible={visible ? 'true' : 'false'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
