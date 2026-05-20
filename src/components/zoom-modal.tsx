import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useFrameRotation } from '@/components/use-frame-rotation'
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/asset'
import { useCss } from '@/lib/theme'

// Pointer-pixel thresholds for the zoom modal's axis-locking image drag.
// AXIS_LOCK_PX: how far the pointer moves before committing to scroll-or-rotate.
// ROTATE_STEP_PX: pointer-px of horizontal travel per frame of rotation
// (mirrors DRAG_STEP_PX in use-frame-rotation so the feel matches).
const AXIS_LOCK_PX = 8
const ROTATE_STEP_PX = 50

interface ZoomModalProps {
  frameUrls: string[]
  selectedFrameIndex: number | null
  setSelectedFrameIndex: Dispatch<SetStateAction<number | null>>
  onClose: () => void
}

// ZoomModal shows the avatar frames at full resolution, layered over the
// fitting-room overlay: 40px inset on every side, scrollable when a frame is
// larger than that area, rotatable (drag or chevrons), with a large close
// affordance top-right.
export function ZoomModal({ frameUrls, selectedFrameIndex, setSelectedFrameIndex, onClose }: ZoomModalProps) {
  // Escape closes the zoom modal only. A capture-phase document listener with
  // stopPropagation keeps the event from reaching react-modal's own Escape
  // handler, which would otherwise close the whole fitting-room overlay.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const { rotateLeft, rotateRight } = useFrameRotation(frameUrls, setSelectedFrameIndex)

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Image-drag handler with an axis lock: after the first AXIS_LOCK_PX of
  // pointer travel, commit to either *scrolling* the inset scroll area
  // (vertical-dominant drag) or *rotating* through frames (horizontal-dominant
  // drag) for the rest of the gesture. This keeps the two interactions from
  // fighting each other when the image overflows the inset.
  //
  // Touch is intentionally not wired up here — the scroll area is
  // `overflow: auto`, so native touch scrolling pans the image; on mobile the
  // chevrons handle rotation. Hijacking touchstart breaks native scrolling.
  const handleImageMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const scrollArea = scrollAreaRef.current
      const startScrollTop = scrollArea?.scrollTop ?? 0
      let mode: 'unknown' | 'scroll' | 'rotate' = 'unknown'
      let lastRotateX = startX

      const onMove = (move: MouseEvent) => {
        const deltaX = move.clientX - startX
        const deltaY = move.clientY - startY
        if (mode === 'unknown') {
          const absX = Math.abs(deltaX)
          const absY = Math.abs(deltaY)
          if (absX < AXIS_LOCK_PX && absY < AXIS_LOCK_PX) {
            return
          }
          mode = absY > absX ? 'scroll' : 'rotate'
          lastRotateX = move.clientX
        }
        if (mode === 'scroll' && scrollArea) {
          // Pulling the image down should move the content downward under
          // the pointer — i.e. scroll the viewport *upward*. scrollTop
          // decreases as deltaY grows.
          scrollArea.scrollTop = startScrollTop - deltaY
        } else if (mode === 'rotate') {
          const rotateDelta = move.clientX - lastRotateX
          if (Math.abs(rotateDelta) >= ROTATE_STEP_PX) {
            if (rotateDelta > 0) {
              rotateRight()
            } else {
              rotateLeft()
            }
            lastRotateX = move.clientX
          }
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

  const css = useCss((_theme) => ({
    backdrop: {
      position: 'fixed',
      inset: 0,
      backgroundColor: '#F4F4F4',
      zIndex: 100,
    },
    scrollArea: {
      position: 'absolute',
      // 40px padding on every side.
      inset: '40px',
      overflow: 'auto',
    },
    // Centres the frame when it fits; grows past the scroll area when it
    // doesn't, so the scroll area scrolls instead of shrinking the image.
    imageWrap: {
      minWidth: '100%',
      minHeight: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      // No sizing — the frame renders at its natural (full) resolution.
      display: 'block',
      flex: 'none',
      cursor: 'grab',
    },
    // Rotation chevrons float at the modal's vertical centre, so they stay
    // put regardless of how the (possibly larger) frame is scrolled.
    chevron: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      cursor: 'pointer',
      zIndex: 1,
    },
    chevronLeft: {
      left: '8px',
    },
    chevronRight: {
      right: '8px',
    },
    chevronIcon: {
      width: '48px',
      height: '48px',
    },
    close: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      width: '44px',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      border: 'none',
      // Reset native button chrome and default padding so the circle renders
      // exactly as styled.
      appearance: 'none',
      WebkitAppearance: 'none',
      padding: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      color: '#FFFFFF',
      fontSize: '32px',
      lineHeight: 1,
      cursor: 'pointer',
      // Keep the "×" glyph from being text-selected — a stray selection
      // paints a dark highlight rectangle behind it.
      userSelect: 'none',
      WebkitUserSelect: 'none',
      zIndex: 1,
    },
  }))

  const imageUrl = frameUrls[selectedFrameIndex ?? 0]

  return (
    <div css={css.backdrop}>
      <div ref={scrollAreaRef} css={css.scrollArea}>
        <div css={css.imageWrap}>
          <img src={imageUrl} css={css.image} alt="" onMouseDown={handleImageMouseDown} />
        </div>
      </div>
      <div css={{ ...css.chevron, ...css.chevronLeft }} onClick={rotateLeft}>
        <ChevronLeftIcon css={css.chevronIcon} />
      </div>
      <div css={{ ...css.chevron, ...css.chevronRight }} onClick={rotateRight}>
        <ChevronRightIcon css={css.chevronIcon} />
      </div>
      <button css={css.close} onClick={onClose} aria-label="Close zoom">
        ×
      </button>
    </div>
  )
}
