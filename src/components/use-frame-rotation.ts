import type { Dispatch, SetStateAction, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import { useCallback } from 'react'

// Pointer pixels of horizontal drag per one frame of rotation.
const DRAG_STEP_PX = 50

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
      if (prev == null || frameCount === 0) return prev
      return prev === 0 ? frameCount - 1 : prev - 1
    })
  }, [frameCount, setSelectedFrameIndex])

  const rotateRight = useCallback(() => {
    setSelectedFrameIndex((prev) => {
      if (prev == null || frameCount === 0) return prev
      return prev === frameCount - 1 ? 0 : prev + 1
    })
  }, [frameCount, setSelectedFrameIndex])

  const handleMouseDragStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      let startX = e.clientX
      const onMove = (move: MouseEvent) => {
        const deltaX = move.clientX - startX
        if (Math.abs(deltaX) >= DRAG_STEP_PX) {
          if (deltaX > 0) rotateRight()
          else rotateLeft()
          startX = move.clientX
        }
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

  const handleTouchDragStart = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault()
      let startX = e.touches[0].clientX
      const onMove = (move: TouchEvent) => {
        const deltaX = move.touches[0].clientX - startX
        if (Math.abs(deltaX) >= DRAG_STEP_PX) {
          if (deltaX > 0) rotateRight()
          else rotateLeft()
          startX = move.touches[0].clientX
        }
      }
      const onEnd = () => {
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
      }
      window.addEventListener('touchmove', onMove)
      window.addEventListener('touchend', onEnd)
    },
    [rotateLeft, rotateRight],
  )

  return { rotateLeft, rotateRight, handleMouseDragStart, handleTouchDragStart }
}
