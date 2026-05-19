import { useEffect } from 'react'
import { useCss } from '@/lib/theme'

interface ZoomModalProps {
  imageUrl: string
  onClose: () => void
}

// ZoomModal shows a single avatar frame at full resolution, layered over the
// fitting-room overlay: 40px inset on every side, scrollable when the image
// is larger than that area, with a large close affordance top-right.
export function ZoomModal({ imageUrl, onClose }: ZoomModalProps) {
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

  const css = useCss((_theme) => ({
    backdrop: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      zIndex: 100,
    },
    scrollArea: {
      position: 'absolute',
      // 40px padding on every side.
      inset: '40px',
      overflow: 'auto',
    },
    // Centres the image when it fits; grows past the scroll area when it
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      color: '#FFFFFF',
      fontSize: '32px',
      lineHeight: 1,
      cursor: 'pointer',
      zIndex: 1,
    },
  }))

  return (
    <div css={css.backdrop}>
      <div css={css.scrollArea}>
        <div css={css.imageWrap}>
          <img src={imageUrl} css={css.image} alt="" />
        </div>
      </div>
      <button css={css.close} onClick={onClose} aria-label="Close zoom">
        ×
      </button>
    </div>
  )
}
