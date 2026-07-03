import { beforeAll, describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// Full prerender-output & security assertions for the production build
// (Plan 04-05 Task 1). Wave 0's build-smoke.test.ts only proved the app
// shell mounts; this file asserts over the ACTUAL built `dist/` directory
// that vite-react-ssg emits, closing out T-04-cfg (app_id must never reach
// the shipped artifacts) for all 6 routes.

const DIST = path.resolve(process.cwd(), 'dist')

function listFilesRecursive(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full))
    } else {
      out.push(full)
    }
  }
  return out
}

// The verify command chain (`npm run test -w web && npm run build -w web`)
// runs tests BEFORE the build, so a clean checkout / CI run would have no
// `dist/` yet. Build once here if missing so this test is self-sufficient
// regardless of call order; reuse an existing `dist/` (e.g. a build already
// run manually or by the outer verify chain) to avoid a redundant rebuild.
beforeAll(() => {
  if (!existsSync(DIST)) {
    execSync('npm run build', { cwd: process.cwd(), stdio: 'inherit' })
  }
}, 120_000)

describe('production build output (dist)', () => {
  const routes = [
    'index.html',
    'discography/index.html',
    'concerts/index.html',
    'about/index.html',
    'contact/index.html',
    'stock/index.html',
  ]

  it.each(routes)('emits %s', (route) => {
    expect(existsSync(path.join(DIST, ...route.split('/')))).toBe(true)
  })

  it('bakes concert data (or the D-12 empty state) into concerts/index.html at build time', () => {
    const html = readFileSync(path.join(DIST, 'concerts', 'index.html'), 'utf-8')
    const hasEmptyState = html.includes('No shows scheduled')
    // Baked concert markup: a <time> element carrying the event's datetime,
    // proof the loader ran server-side and the value was rendered into HTML
    // (not left for a client-side fetch to fill in later).
    const hasBakedEvent = /<time[^>]*datetime="/.test(html)
    expect(hasEmptyState || hasBakedEvent).toBe(true)
  })

  it('never ships a Bandsintown app_id secret VALUE anywhere in dist (T-04-cfg / Pitfall 8)', () => {
    // Scan every text-ish output file (HTML pages, client JS bundles, and
    // the static-loader-data JSON vite-react-ssg serializes for client
    // hydration — Plan 04-02 found the JSON is a leak vector distinct from
    // the rendered HTML). Skip binary assets (fonts/images).
    const files = listFilesRecursive(DIST).filter((f) => /\.(html|js|json)$/.test(f))
    expect(files.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // A real leak looks like `app_id=<value>` inside a URL/query string.
      // The bare string "app_id" alone legitimately appears in the client
      // bundle as the literal argument to clean()'s own
      // `searchParams.delete('app_id')` call (the sanitizer, not a secret —
      // see Plan 04-02 SUMMARY "Issues Encountered"), so only the
      // query-parameter-with-a-value pattern is treated as a leak.
      if (/app_id=[^&"'\s]/.test(content)) {
        offenders.push(path.relative(DIST, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('every workspace package.json declares a unique name (Vercel skip-unaffected requirement)', () => {
    const repoRoot = path.resolve(process.cwd(), '..')
    const pkgPaths = [
      'web/package.json',
      'mobile/package.json',
      'api/package.json',
      'packages/shared/package.json',
    ]
    const names = pkgPaths.map(
      (p) => JSON.parse(readFileSync(path.join(repoRoot, p), 'utf-8')).name as string,
    )
    expect(names.every((n) => typeof n === 'string' && n.length > 0)).toBe(true)
    expect(new Set(names).size).toBe(names.length)
  })
})
