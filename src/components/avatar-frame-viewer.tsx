import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import { Loading } from '@/components/content/loading'
import { useFrameRotation } from '@/components/use-frame-rotation'
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/asset'
import type { StyleProp } from '@/lib/theme'
import { useCss } from '@/lib/theme'

interface AvatarFrameViewerProps {
  frameUrls: string[] | null
  selectedFrameIndex: number | null
  setSelectedFrameIndex: Dispatch<SetStateAction<number | null>>
  imageContainerStyle: StyleProp
  imageStyle: StyleProp
  loadingT?: string
  // Optional callback fired the moment the user manually moves the frame
  // (chevron tap or drag). Used by parents that run useAutoRotate to halt
  // an in-flight rotation as soon as the user takes control.
  onUserInteract?: () => void
}

// AvatarFrameViewer renders a single avatar/VTO frame from `frameUrls` with
// prev/next chevrons and pointer/touch drag rotation. Frame state is owned by
// the parent so callers can compose additional controls (e.g. a slider) that
// share the same index. Caller sets the image dimensions via the two
// container/image style props; this component does not measure itself.
export function AvatarFrameViewer({
  frameUrls,
  selectedFrameIndex,
  setSelectedFrameIndex,
  imageContainerStyle,
  imageStyle,
  loadingT = 'quick-view.avatar_loading',
  onUserInteract,
}: AvatarFrameViewerProps) {
  const css = useCss((_theme) => ({
    imageContainer: {
      position: 'absolute',
    },
    image: {
      objectFit: 'contain',
      cursor: 'grab',
      // Reserve horizontal touch gestures for our rotation handler — the
      // browser can still pan vertically natively. Without this, the
      // browser may start consuming a horizontal swipe as a scroll/zoom
      // before our touchmove listener can preventDefault, which produced
      // the "janky first swipe" reports.
      touchAction: 'pan-y',
    },
    chevronLeftContainer: {
      position: 'absolute',
      top: '50%',
      left: '0',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    },
    chevronRightContainer: {
      position: 'absolute',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    },
    chevronIcon: {
      width: '48px',
      height: '48px',
    },
  }))

  // Default to frame 0 when frames first arrive — otherwise the viewer
  // would sit on the Loading state forever for callers that don't drive
  // selectedFrameIndex. The auto-rotate animation lives in useAutoRotate
  // on the parent (Avatar in quick-view, AvatarPane in fitting-room) —
  // see use-auto-rotate.ts for why it's hosted up there.
  useEffect(() => {
    if (frameUrls && frameUrls.length > 0 && selectedFrameIndex == null) {
      setSelectedFrameIndex(0)
    }
  }, [frameUrls, selectedFrameIndex, setSelectedFrameIndex])

  const { rotateLeft, rotateRight, handleMouseDragStart, handleTouchDragStart } = useFrameRotation(
    frameUrls,
    setSelectedFrameIndex,
    onUserInteract,
  )

  if (!frameUrls || selectedFrameIndex == null) {
    return <Loading t={loadingT} />
  }

  return (
    <div css={css.imageContainer} style={imageContainerStyle}>
      <img
        src={frameUrls[selectedFrameIndex]}
        css={css.image}
        style={imageStyle}
        onMouseDown={handleMouseDragStart}
        onTouchStart={handleTouchDragStart}
      />
      {/* onMouseDown preventDefault keeps rapid clicks from initiating a text
          selection — otherwise the second/third click in a fast tap-tap-tap
          starts dragging a selection that extends across nearby overlay text
          (the avatar-control pill labels in the same VTO frame). */}
      <div
        role="button"
        aria-label="Rotate left"
        css={css.chevronLeftContainer}
        onMouseDown={(e) => e.preventDefault()}
        onClick={rotateLeft}
      >
        <ChevronLeftIcon css={css.chevronIcon} />
      </div>
      <div
        role="button"
        aria-label="Rotate right"
        css={css.chevronRightContainer}
        onMouseDown={(e) => e.preventDefault()}
        onClick={rotateRight}
      >
        <ChevronRightIcon css={css.chevronIcon} />
      </div>
    </div>
  )
}
