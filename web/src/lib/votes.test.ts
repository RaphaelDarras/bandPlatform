import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeFillLevels, fetchVotes, castVote } from './votes'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('computeFillLevels', () => {
  it('returns zeros without NaN when all counts are 0', () => {
    expect(computeFillLevels({ a: 0, b: 0, c: 0, d: 0 })).toEqual({ a: 0, b: 0, c: 0, d: 0 })
  })
  it('scales relative to the leader', () => {
    expect(computeFillLevels({ a: 10, b: 5, c: 0, d: 2 })).toEqual({ a: 1, b: 0.5, c: 0, d: 0.2 })
  })
  it('gives tied leaders 1 and treats missing ids as 0', () => {
    expect(computeFillLevels({ a: 4, b: 4 })).toEqual({ a: 1, b: 1, c: 0, d: 0 })
  })
})

describe('fetchVotes / castVote', () => {
  const tally = { counts: { a: 1, b: 0, c: 0, d: 0 }, total: 1 }

  it('fetchVotes GETs the tally', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => tally })
    vi.stubGlobal('fetch', f)
    await expect(fetchVotes()).resolves.toEqual(tally)
    expect(f.mock.calls[0][0]).toMatch(/\/api\/votes$/)
  })
  it('fetchVotes throws on non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    await expect(fetchVotes()).rejects.toThrow()
  })
  it('castVote POSTs JSON', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => tally })
    vi.stubGlobal('fetch', f)
    await expect(castVote('b')).resolves.toEqual(tally)
    const [url, init] = f.mock.calls[0]
    expect(url).toMatch(/\/api\/votes$/)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ choice: 'b' })
  })
  it('castVote throws with the API error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Invalid choice' }) }))
    await expect(castVote('a')).rejects.toThrow('Invalid choice')
  })
})
