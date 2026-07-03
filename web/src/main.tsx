import { ViteReactSSG } from 'vite-react-ssg'
import { routes } from './App'
import './styles.css'

// Self-hosted fonts (OFL) — Bebas Neue (display) + Inter (body/label).
import '@fontsource/bebas-neue/400.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'

export const createRoot = ViteReactSSG({ routes })
