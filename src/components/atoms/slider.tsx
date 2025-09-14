import type { TargetedEvent } from 'preact'

interface SliderProps {
  id?: string
  min?: number
  max?: number
  value: number
  onChange: (event: number) => void
  step?: number
  disabled?: boolean
  className?: string
  ariaLabel?: string
  ariaValueText?: string
}

export const Slider = ({
  id,
  min = 0,
  max = 100,
  value,
  onChange,
  step = 1,
  disabled = false,
  className = '',
  ariaLabel,
  ariaValueText,
}: SliderProps) => {
  const handleChange = (e: TargetedEvent<HTMLInputElement, Event>) => {
    const newValue = parseFloat((e.target as HTMLInputElement).value)
    onChange(newValue)
  }

  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className={`tfr-slider-container ${className}`}>
      <input
        id={id}
        type="range"
        className="tfr-slider"
        min={min}
        max={max}
        value={value}
        step={step}
        disabled={disabled}
        onChange={handleChange}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={ariaValueText || value.toString()}
      />
      <div className="tfr-slider-track">
        <div className="tfr-slider-fill" style={{ width: `${percentage}%` }} />
        <div className="tfr-slider-thumb" style={{ left: `${percentage}%` }} />
      </div>
    </div>
  )
}
