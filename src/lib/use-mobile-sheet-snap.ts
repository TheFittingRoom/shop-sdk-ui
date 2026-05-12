import { useCallback, useState } from 'react'

export type SheetSnap = 'collapsed' | 'expanded' | 'full'

// useMobileSheetSnap encapsulates the three-snap bottom-sheet state machine
// (collapsed → expanded → full) plus the touchstart handler that promotes /
// demotes the snap based on a single ≥ 30px touchmove delta. Each handleTouchStart
// invocation captures the snap at touch time so a fast swipe doesn't double-step.
export function useMobileSheetSnap(initial: SheetSnap = 'collapsed') {
  const [snap, setSnap] = useState<SheetSnap>(initial)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const startY = e.touches[0].clientY
      const initialSnap = snap
      const onTouchMove = (moveEvent: TouchEvent) => {
        const deltaY = moveEvent.touches[0].clientY - startY
        if (Math.abs(deltaY) < 30) return
        if (deltaY > 0) {
          if (initialSnap === 'full' || initialSnap === 'expanded') {
            setSnap('collapsed')
          }
        } else {
          if (initialSnap === 'collapsed') {
            setSnap('expanded')
          } else if (initialSnap === 'expanded') {
            setSnap('full')
          }
        }
        document.removeEventListener('touchmove', onTouchMove)
      }
      document.addEventListener('touchmove', onTouchMove)
      const onTouchEnd = () => {
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onTouchEnd)
      }
      document.addEventListener('touchend', onTouchEnd)
    },
    [snap],
  )

  return { snap, setSnap, handleTouchStart }
}
