import { VtoSlider } from '@molecules/vto-slider'

export interface VtoProps {
  frames: string[]
  currentFrameIndex: number
  onFrameChange: (index: number) => void
  preloadFrames?: boolean
  className?: string
  id?: string
}

export const Vto = ({
  frames,
  currentFrameIndex,
  onFrameChange,
  preloadFrames = true,
  className = '',
  id = 'tfr-vto',
}: VtoProps) => {
  const validIndex = Math.max(0, Math.min(currentFrameIndex, frames.length - 1))

  return (
    <div id={id} className={`tfr-vto-container ${className}`}>
      {preloadFrames && frames.length > 0 && (
        <div style={{ display: 'none' }} aria-hidden="true">
          {frames.map((frame, index) => (
            <img key={`preload-${index}`} src={frame} alt="" loading="eager" />
          ))}
        </div>
      )}
      <VtoSlider
        frames={frames}
        currentIndex={validIndex}
        onIndexChange={onFrameChange}
        className="tfr-vto-slider-wrapper"
      />
      {preloadFrames && frames.length > 1 && (
        <div className="tfr-vto-frame-counter">
          {validIndex + 1} / {frames.length}
        </div>
      )}
    </div>
  )
}
