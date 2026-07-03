import { describe, it, expect } from 'vitest'
import { clean, nextEvent, venueDisplay, fetchUpcomingEvents, sanitizeEvent } from './bandsintown'
import type { BitEvent } from './bandsintown'
import fixture from './__fixtures__/bandsintown-events.json'

// Fixture-driven parse/mapping test (Plan 04-02, Task 1). No network call —
// the live Bandsintown response shape is locked in RESEARCH Pitfall 2 and
// baked into the fixture; network verification is a Manual-Only step.
const events = fixture as BitEvent[]

describe('bandsintown fixture parsing', () => {
  it('parses the fixture into BitEvent[] with expected fields', () => {
    expect(events).toHaveLength(2)
    expect(events[0].id).toBe('107890636')
    expect(events[0].venue.city).toBe('Gravigny')
    expect(events[1].venue.name).toBe('Le Bikini')
  })
})

describe('clean', () => {
  it('removes app_id from a URL that contains it and keeps other params', () => {
    const dirty = 'https://x/e/1?app_id=SECRET&came_from=267'
    const result = clean(dirty)
    expect(result).not.toContain('app_id')
    expect(result).not.toContain('SECRET')
    expect(result).toContain('came_from=267')
  })

  it('strips app_id from the fixture offer url', () => {
    const result = clean(events[0].offers[0].url)
    expect(result).not.toContain('app_id')
  })

  it('strips app_id from the fixture top-level event url', () => {
    const result = clean(events[0].url)
    expect(result).not.toContain('app_id')
  })

  it('leaves a URL without app_id untouched aside from normalization', () => {
    const result = clean(events[1].url)
    expect(result).not.toContain('app_id')
  })
})

describe('sanitizeEvent (deep app_id redaction — D-09 hydration-leak regression)', () => {
  it('strips app_id from top-level url, offers[].url, AND nested artist.url', () => {
    const sanitized = sanitizeEvent(events[0])
    // The whole serialized event (what gets baked into the SSG hydration JSON)
    // must not contain the key anywhere — this is the exact leak vector that
    // shipped to production: artist.url was undeclared and passed through.
    const serialized = JSON.stringify(sanitized)
    expect(serialized).not.toContain('app_id=')
    expect(serialized).not.toContain('FAKE_TEST_APP_ID_0000')
    // artist object is preserved (just scrubbed), not dropped
    expect(sanitized.artist?.url).toBeDefined()
    expect(sanitized.artist?.url).not.toContain('app_id')
    expect(sanitized.url).not.toContain('app_id')
    expect(sanitized.offers[0].url).not.toContain('app_id')
  })

  it('leaves an event with no app_id anywhere structurally intact', () => {
    const sanitized = sanitizeEvent(events[1])
    expect(JSON.stringify(sanitized)).not.toContain('app_id=')
    expect(sanitized.id).toBe('108001122')
    expect(sanitized.venue.name).toBe('Le Bikini')
  })
})

describe('venueDisplay', () => {
  it('returns location + title for the festival-quirk event (venue.name === title)', () => {
    const festival = events[0]
    expect(festival.venue.name).toBe(festival.title)
    const display = venueDisplay(festival)
    expect(display).toContain(festival.venue.location)
    expect(display).toContain(festival.title as string)
  })

  it('returns venue.name for a normal (non-festival-quirk) event', () => {
    const normal = events[1]
    expect(normal.venue.name).not.toBe(normal.title)
    const display = venueDisplay(normal)
    expect(display).toContain(normal.venue.name)
  })
})

describe('nextEvent', () => {
  it('returns the first element of a non-empty array', () => {
    expect(nextEvent(events)).toBe(events[0])
  })

  it('returns null for an empty array', () => {
    expect(nextEvent([])).toBeNull()
  })
})

describe('fetchUpcomingEvents fail-soft behavior', () => {
  it('returns [] (not throw) when app_id is unset (no network call in test env)', async () => {
    const result = await fetchUpcomingEvents()
    expect(result).toEqual([])
  })
})
