// Shared chevron icon for the fitting-room overlay — accordion headers
// (up/down) and card-rail scroll handles (left/right). One SVG path rotated
// by direction, so every chevron in the overlay is visually identical.
type ChevronDirection = 'up' | 'down' | 'left' | 'right'

const ROTATION_DEG: Record<ChevronDirection, number> = {
  down: 0,
  up: 180,
  left: 90,
  right: -90,
}

interface ChevronProps {
  direction: ChevronDirection
  size?: number
}

export function Chevron({ direction, size = 24 }: ChevronProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        transition: 'transform 200ms ease',
        transform: `rotate(${ROTATION_DEG[direction]}deg)`,
      }}
    >
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
