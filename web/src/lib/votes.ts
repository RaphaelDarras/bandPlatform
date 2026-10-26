const API = import.meta.env.VITE_API_URL ?? 'https://hurakan-band-platform.onrender.com'

// ============================================================================
// EDIT THE 4 LABELS AND DESCRIPTIONS HERE — the only place they live.
// Do NOT change ids without changing api/utils/voteChoices.js.
// ============================================================================
export const VOTE_CHOICES = [
  {
    id: 'a',
    label: 'Imperial Stout',
    description: "Sombre et forte, comme notre musique. Besoin de plus d'explications ?",
  },
  {
    id: 'b',
    label: 'Blanche au blé noir',
    description: "On fait du slam mélodique, alors une blanche au blé noir, c'était logique.",
  },
  {
    id: 'c',
    label: 'Sour aux fruits noirs',
    description:
      "Parce qu'on n'est pas que des brutes. Acidulée, fruitée… mais noire quand même, faut pas déconner.",
  },
  {
    id: 'd',
    label: 'Blonde au piment',
    description: 'Ça commence tout doux, ça finit en blast.',
  },
] as const

export type VoteChoiceId = (typeof VOTE_CHOICES)[number]['id']

export interface VoteTally {
  counts: Record<VoteChoiceId, number>
  total: number
}

// Max-relative scaling: with 4 choices a total-relative scale caps the leader
// near 25-50%, so every bottle would look mostly empty. Max-relative makes the
// leader a full bottle and the others read as "how close to the leader".
// Absolute counts are displayed numerically so they are never hidden.
export function computeFillLevels(
  counts: Partial<Record<VoteChoiceId, number>>,
): Record<VoteChoiceId, number> {
  const values = VOTE_CHOICES.map((c) => counts[c.id] ?? 0)
  const max = Math.max(0, ...values)
  const out = {} as Record<VoteChoiceId, number>
  VOTE_CHOICES.forEach((c, i) => {
    out[c.id] = max > 0 ? Math.min(1, Math.max(0, values[i] / max)) : 0
  })
  return out
}

async function parse(res: Response): Promise<VoteTally> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message)
  }
  return (await res.json()) as VoteTally
}

export async function fetchVotes(): Promise<VoteTally> {
  return parse(await fetch(`${API}/api/votes`))
}

export async function castVote(choice: VoteChoiceId): Promise<VoteTally> {
  return parse(
    await fetch(`${API}/api/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    }),
  )
}
