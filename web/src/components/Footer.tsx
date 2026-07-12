import { Link } from 'react-router-dom'

// Present on every page via Layout. Text links to /about and /contact
// (footer-only routes, D-15/D-24) plus external channels shown as icons:
// Email, Instagram, Spotify, and the Shopify storefront (D-14).

const textLinkClass =
  'font-sans text-xs font-semibold uppercase tracking-[0.06em] text-white/75 hover:text-white'
const iconLinkClass =
  'flex h-9 w-9 items-center justify-center text-white/75 hover:text-white'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-hairline)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <nav aria-label="Secondary" className="flex items-center gap-4">
          <Link to="/about" className={textLinkClass}>
            About
          </Link>
          <Link to="/contact" className={textLinkClass}>
            Contact
          </Link>
        </nav>

        <nav aria-label="Social and contact" className="flex items-center gap-1">
          <a href="mailto:hurakanband@gmail.com" rel="noopener" aria-label="Email" className={iconLinkClass}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/hurakanband/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className={iconLinkClass}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a
            href="https://www.tiktok.com/@hurakanband"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className={iconLinkClass}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
          </a>
          <a
            href="https://open.spotify.com/artist/5w35Gt5153qhoSwR4MVtEU"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Spotify"
            className={iconLinkClass}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 0 1 .207.857Zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 1 1-.452-1.492c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 0 1 .256 1.072Zm.105-2.835c-3.222-1.913-8.539-2.088-11.617-1.153a.935.935 0 1 1-.542-1.79c3.532-1.072 9.404-.865 13.115 1.338a.934.934 0 1 1-.956 1.605Z" />
            </svg>
          </a>
          <a
            href="https://shop.hurakanband.fr/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Shop"
            className={iconLinkClass}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  )
}
