import { useId } from 'react'

// Bottle silhouette (neck + shoulders + body) in a 60x160 viewBox.
const BOTTLE_PATH =
  'M24 4 H36 V14 L37 40 C37 52 50 58 50 76 V148 Q50 156 42 156 H18 Q10 156 10 148 V76 C10 58 23 52 23 40 L24 14 Z'

interface BeerBottleProps {
  fill: number
  label: string
}

export default function BeerBottle({ fill, label }: BeerBottleProps) {
  const clipId = useId()
  const level = Number.isFinite(fill) ? Math.min(1, Math.max(0, fill)) : 0
  return (
    <svg
      viewBox="0 0 60 160"
      role="img"
      aria-label={`${label}: ${Math.round(level * 100)}%`}
      data-fill={level}
      className="h-56 w-auto"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BOTTLE_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g
          style={{
            transform: `scaleY(${level})`,
            transformBox: 'fill-box',
            transformOrigin: 'bottom',
            transition: 'transform 700ms ease-out',
          }}
        >
          <rect x="0" y="0" width="60" height="160" fill="#d99a1e" />
          <rect x="0" y="0" width="60" height="6" fill="#f5ecd0" />
        </g>
      </g>
      <path d={BOTTLE_PATH} fill="none" stroke="var(--color-ink)" strokeWidth="2" />
    </svg>
  )
}
