import { Slider } from '@atoms/slider'
import { VtoImage } from '@atoms/vto-image'

interface VtoSliderProps {
  frames: string[]
  currentIndex: number
  onIndexChange: (index: number) => void
  className?: string
}

export const VtoSlider = ({ frames, currentIndex, onIndexChange, className = '' }: VtoSliderProps) => {
  const hasFrames = frames && frames.length > 0
  const currentFrame = hasFrames ? frames[currentIndex] || frames[0] : ''

  if (!hasFrames) {
    return (
      <div className={`tfr-vto-slider-empty ${className}`}>
        <div className="tfr-vto-no-frames">No frames available</div>
      </div>
    )
  }

  return (
    <div className={`tfr-vto-slider tfr-slider-wrapper ${className}`}>
      <VtoImage
        id="tfr-tryon-image"
        src={currentFrame}
        alt={`Virtual try-on frame ${currentIndex + 1} of ${frames.length}`}
        className="tfr-vto-frame-image"
      />
      {frames.length > 1 && (
        <Slider
          id="tfr-slider"
          min={0}
          max={frames.length - 1}
          value={currentIndex}
          onChange={onIndexChange}
          step={1}
          className="tfr-vto-frame-slider"
          ariaLabel="Navigate through virtual try-on frames"
          ariaValueText={`Frame ${currentIndex + 1} of ${frames.length}`}
        />
      )}
    </div>
  )
}
