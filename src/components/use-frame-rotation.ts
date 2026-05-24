import type { Dispatch, SetStateAction, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import { useCallback } from 'react'

// Pointer pixels of horizontal drag per one frame of rotation.
const DRAG_STEP_PX = 50
// Pointer pixels of travel before a touch drag commits to either a horizontal
// (rotation) or vertical (scroll) gesture. Also acts as a drag-vs-tap
// threshold: stray finger jitter below this never starts firing rotations.
const AXIS_LOCK_PX = 8

// applyDragSteps fires as many rotation steps as the total horizontal travel
// has earned and returns how many pixels were consumed. The caller advances
// its `startX` by the returned amount so leftover sub-step travel rolls over
// into the next move event. This is the multi-step fix: a fast swipe of N×
// DRAG_STEP_PX in a single move event rotates N frames, not 1. Exported so
// the zoom modal's own axis-locking drag handler uses the same step size.
export function applyDragSteps(deltaX: number, rotateLeft: () => void, rotateRight: () => void): number {
  const steps = Math.floor(Math.abs(deltaX) / DRAG_STEP_PX)
  if (steps === 0) {
    return 0
  }
  const fn = deltaX > 0 ? rotateRight : rotateLeft
  for (let i = 0; i < steps; i++) {
    fn()
  }
  return (deltaX > 0 ? 1 : -1) * steps * DRAG_STEP_PX
}

// useFrameRotation produces the rotate actions and pointer-drag handlers for a
// frame carousel (avatar frame viewer, zoom modal). The caller owns the
// selected-index state; this hook only steps it. rotateLeft/rotateRight wrap
// around and no-op while the index is still null (frames not ready).
export function useFrameRotation(
  frameUrls: string[] | null,
  setSelectedFrameIndex: Dispatch<SetStateAction<number | null>>,
) {
  const frameCount = frameUrls?.length ?? 0

  const rotateLeft = useCallback(() => {
    setSelectedFrameIndex((prev) => {
      if (prev == null || frameCount === 0) {
        return prev
      }
      return prev === 0 ? frameCount - 1 : prev - 1
    })
  }, [frameCount, setSelectedFrameIndex])

  const rotateRight = useCallback(() => {
    setSelectedFrameIndex((prev) => {
      if (prev == null || frameCount === 0) {
        return prev
      }
      return prev === frameCount - 1 ? 0 : prev + 1
    })
  }, [frameCount, setSelectedFrameIndex])

  const handleMouseDragStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      let startX = e.clientX
      const onMove = (move: MouseEvent) => {
        startX += applyDragSteps(move.clientX - startX, rotateLeft, rotateRight)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [rotateLeft, rotateRight],
  )

  // Touch drag with an axis lock: after AXIS_LOCK_PX of travel, commit to
  // either *rotation* (horizontal-dominant) or *scroll* (vertical-dominant)
  // for the rest of the gesture. Horizontal rotation calls preventDefault on
  // each move so the page doesn't try to pan-x alongside it. The vertical
  // branch deliberately does NOT preventDefault so native vertical scrolling
  // keeps working. The companion CSS `touch-action: pan-y` on the avatar img
  // tells the browser the same thing up-front so it doesn't claim horizontal
  // gestures before our handler can react. Also note: `e.preventDefault()`
  // on the React touchstart synthetic event is intentionally NOT called —
  // React attaches touchstart as passive (>= v17) so that call is a no-op.
  // The `{ passive: false }` on touchmove below is what actually lets the
  // browser respect preventDefault inside the move handler.
  const handleTouchDragStart = useCallback(
    (e: ReactTouchEvent) => {
      let startX = e.touches[0].clientX
      const startY = e.touches[0].clientY
      let mode: 'unknown' | 'horizontal' | 'vertical' = 'unknown'

      const onMove = (move: TouchEvent) => {
        const currentX = move.touches[0].clientX
        const currentY = move.touches[0].clientY
        if (mode === 'unknown') {
          const absDx = Math.abs(currentX - startX)
          const absDy = Math.abs(currentY - startY)
          if (absDx < AXIS_LOCK_PX && absDy < AXIS_LOCK_PX) {
            return
          }
          mode = absDx >= absDy ? 'horizontal' : 'vertical'
          // Reset startX to the lock-decision point so the AXIS_LOCK_PX
          // already travelled doesn't count toward the first rotation
          // (which would feel like a jump at the start of the drag).
          startX = currentX
        }
        if (mode !== 'horizontal') {
          return
        }
        move.preventDefault()
        startX += applyDragSteps(currentX - startX, rotateLeft, rotateRight)
      }
      const onEnd = () => {
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
        window.removeEventListener('touchcancel', onEnd)
      }
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
      window.addEventListener('touchcancel', onEnd)
    },
    [rotateLeft, rotateRight],
  )

  return { rotateLeft, rotateRight, handleMouseDragStart, handleTouchDragStart }
}
