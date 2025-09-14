import { L } from '@locale'

import type { TryOnModalProps } from '@types'
import { useEffect, useRef } from 'preact/hooks'

export const TryOnModal = ({ isOpen = true, frames, onClose, onNavBack }: TryOnModalProps) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isOpen || !frames?.length) return null

    const tryOnImage = imageRef.current
    const slider = sliderRef.current

    if (!tryOnImage || !slider) return null

    const onChange = (sliderElement: HTMLInputElement, imageUrl: string) => {
      console.debug('slider change', sliderElement, imageUrl)
      tryOnImage.src = imageUrl
    }

    slider.min = '0'
    slider.max = String(frames.length - 1)
    slider.value = '0'
    slider.step = '1'

    if (frames.length > 0) {
      tryOnImage.src = frames[0]
    }

    const handleSliderChange = () => {
      const index = parseInt(slider.value, 10)
      if (frames[index]) {
        onChange(slider, frames[index])
      }
    }

    slider.addEventListener('input', handleSliderChange)

    cleanupRef.current = () => {
      slider.removeEventListener('input', handleSliderChange)
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [isOpen, frames])

  if (!isOpen) return null

  return (
    <div className="tfr-modal tfr-modal-full">
      <div className="tfr-modal-content">
        <div className="tfr-slider-wrapper">
          <img id="tfr-tryon-image" ref={imageRef} src="" alt="Try on" />
          <input type="range" id="tfr-slider" ref={sliderRef} />
        </div>

        {/* Navigation buttons using the old IDs for backward compatibility */}
        <div className="tfr-t-a-center" style={{ marginTop: '20px' }}>
          {onNavBack && (
            <span
              id="tfr-back"
              tfr-element="true"
              className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20"
              onClick={onNavBack}
            >
              {L.ReturnToProductPage || 'Back'}
            </span>
          )}
          <span
            id="tfr-close"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor"
            onClick={onClose}
          >
            {L.Close || 'Close'}
          </span>
        </div>
      </div>
    </div>
  )
}
