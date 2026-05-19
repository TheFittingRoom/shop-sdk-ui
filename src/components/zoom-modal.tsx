import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import { useFrameRotation } from '@/components/use-frame-rotation'
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/asset'
import { useCss } from '@/lib/theme'

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

  const { rotateLeft, rotateRight, handleMouseDragStart, handleTouchDragStart } = useFrameRotation(
    frameUrls,
    setSelectedFrameIndex,
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
      <div css={css.scrollArea}>
        <div css={css.imageWrap}>
          <img
            src={imageUrl}
            css={css.image}
            alt=""
            onMouseDown={handleMouseDragStart}
            onTouchStart={handleTouchDragStart}
          />
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
