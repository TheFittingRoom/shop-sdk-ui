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
}: AvatarFrameViewerProps) {
  const css = useCss((_theme) => ({
    imageContainer: {
      position: 'absolute',
    },
    image: {
      objectFit: 'contain',
      cursor: 'grab',
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

  // Auto-rotate avatar on initial frame load
  useEffect(() => {
    if (!frameUrls || frameUrls.length === 0 || selectedFrameIndex != null) {
      return
    }
    let currentFrameIndex = 0
    setSelectedFrameIndex(currentFrameIndex)
    const intervalId = setInterval(() => {
      currentFrameIndex = (currentFrameIndex + 1) % frameUrls.length
      setSelectedFrameIndex(currentFrameIndex)
      if (currentFrameIndex === 0) {
        clearInterval(intervalId)
      }
    }, 500)
    return () => clearInterval(intervalId)
  }, [frameUrls, selectedFrameIndex, setSelectedFrameIndex])

  const { rotateLeft, rotateRight, handleMouseDragStart, handleTouchDragStart } = useFrameRotation(
    frameUrls,
    setSelectedFrameIndex,
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
      <div css={css.chevronLeftContainer} onMouseDown={(e) => e.preventDefault()} onClick={rotateLeft}>
        <ChevronLeftIcon css={css.chevronIcon} />
      </div>
      <div css={css.chevronRightContainer} onMouseDown={(e) => e.preventDefault()} onClick={rotateRight}>
        <ChevronRightIcon css={css.chevronIcon} />
      </div>
    </div>
  )
}
