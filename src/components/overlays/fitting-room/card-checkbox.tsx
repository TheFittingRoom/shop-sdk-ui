import type { MouseEvent } from 'react'
import { useCss } from '@/lib/theme'

interface CardCheckboxProps {
  state: 'selected' | 'unselected' | 'disabled'
  onClick?: () => void
  ariaLabel?: string
}

// Toggle-pill control on every fitting-room rail card. Top-left anchor.
// The card body is still the primary toggle; this is an explicit visual
// affordance + a redundant click target. Stops propagation so it doesn't
// double-fire the body.
//
// Track: 36×20 pill. Thumb: 16×16 circle that slides between left and right
// ends. Off = grey track. On = green track. Disabled = greyed, thumb stays
// at the off position.
export function CardCheckbox({ state, onClick, ariaLabel }: CardCheckboxProps) {
  const css = useCss((theme) => ({
    base: {
      position: 'absolute',
      top: '8px',
      left: '8px',
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      border: 'none',
      padding: 0,
      zIndex: 1,
      transition: 'background-color 150ms ease-out',
    },
    unselected: {
      backgroundColor: '#D4D4D4',
      cursor: 'pointer',
    },
    selected: {
      backgroundColor: theme.color_tfr_800,
      cursor: 'pointer',
    },
    disabled: {
      backgroundColor: '#EAEAEA',
      cursor: 'not-allowed',
      pointerEvents: 'none',
    },
    thumb: {
      position: 'absolute',
      top: '2px',
      width: '16px',
      height: '16px',
      borderRadius: '8px',
      backgroundColor: '#FFFFFF',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
      transition: 'left 150ms ease-out',
    },
    thumbOff: {
      left: '2px',
    },
    thumbOn: {
      left: '18px',
    },
  }))

  const trackCss = state === 'selected' ? css.selected : state === 'disabled' ? css.disabled : css.unselected
  const thumbPosCss = state === 'selected' ? css.thumbOn : css.thumbOff

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (state === 'disabled' || !onClick) {
      return
    }
    onClick()
  }

  return (
    <button
      type="button"
      css={{ ...css.base, ...trackCss }}
      onClick={handleClick}
      aria-pressed={state === 'selected'}
      aria-disabled={state === 'disabled'}
      aria-label={ariaLabel}
    >
      <span css={{ ...css.thumb, ...thumbPosCss }} />
    </button>
  )
}
