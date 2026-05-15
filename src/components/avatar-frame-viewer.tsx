import { useCallback, useEffect, Dispatch, SetStateAction } from 'react'
import { Loading } from '@/components/content/loading'
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/asset'
import { useCss, StyleProp } from '@/lib/theme'

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
  loadingT = 'vto-single.avatar_loading',
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
    },
    chevronRightContainer: {
      position: 'absolute',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
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

  const rotateLeft = useCallback(() => {
    setSelectedFrameIndex((prevIndex) => {
      if (prevIndex == null) return null
      return prevIndex === 0 ? (frameUrls ? frameUrls.length - 1 : 0) : prevIndex - 1
    })
  }, [frameUrls, setSelectedFrameIndex])
  const rotateRight = useCallback(() => {
    setSelectedFrameIndex((prevIndex) => {
      if (prevIndex == null) return null
      return prevIndex === (frameUrls ? frameUrls.length - 1 : 0) ? 0 : prevIndex + 1
    })
  }, [frameUrls, setSelectedFrameIndex])

  const handleImageMouseDrag = useCallback(
    (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
      e.preventDefault()
      let startX = e.clientX
      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        if (Math.abs(deltaX) >= 50) {
          if (deltaX > 0) rotateRight()
          else rotateLeft()
          startX = moveEvent.clientX
        }
      }
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [rotateLeft, rotateRight],
  )
  const handleImageTouchDrag = useCallback(
    (e: React.TouchEvent<HTMLImageElement>) => {
      e.preventDefault()
      let startX = e.touches[0].clientX
      const onTouchMove = (moveEvent: TouchEvent) => {
        const deltaX = moveEvent.touches[0].clientX - startX
        if (Math.abs(deltaX) >= 50) {
          if (deltaX > 0) rotateRight()
          else rotateLeft()
          startX = moveEvent.touches[0].clientX
        }
      }
      const onTouchEnd = () => {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
      window.addEventListener('touchmove', onTouchMove)
      window.addEventListener('touchend', onTouchEnd)
    },
    [rotateLeft, rotateRight],
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
        onMouseDown={handleImageMouseDrag}
        onTouchStart={handleImageTouchDrag}
      />
      <div css={css.chevronLeftContainer} onClick={rotateLeft}>
        <ChevronLeftIcon css={css.chevronIcon} />
      </div>
      <div css={css.chevronRightContainer} onClick={rotateRight}>
        <ChevronRightIcon css={css.chevronIcon} />
      </div>
    </div>
  )
}
