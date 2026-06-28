import type { MouseEvent } from 'react'
import { useCss } from '@/lib/theme'

interface CardCheckboxProps {
  state: 'selected' | 'unselected' | 'disabled'
  onClick?: () => void
  ariaLabel?: string
}

// Three-state visual checkbox on every fitting-room rail card. Mirrors the
// removeButton geometry (top-left, ~22px square). The card body is still the
// primary toggle; this gives the affordance an obvious shape AND a redundant
// click target. Stops propagation so it doesn't double-fire the body.
//
// Explicit grey palette on the disabled state so the affordance still reads
// through the container's `opacity: 0.35` dim.
export function CardCheckbox({ state, onClick, ariaLabel }: CardCheckboxProps) {
  const css = useCss((theme) => ({
    base: {
      position: 'absolute',
      top: '8px',
      left: '8px',
      width: '22px',
      height: '22px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      zIndex: 1,
    },
    unselected: {
      backgroundColor: '#FFFFFF',
      border: `1.5px solid ${theme.color_fg_text}`,
      cursor: 'pointer',
    },
    selected: {
      backgroundColor: '#22C55E',
      border: 'none',
      cursor: 'pointer',
    },
    disabled: {
      backgroundColor: '#E5E5E5',
      border: '1.5px solid #B5B5B5',
      cursor: 'not-allowed',
      pointerEvents: 'none',
    },
  }))

  const variantCss = state === 'selected' ? css.selected : state === 'disabled' ? css.disabled : css.unselected

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
      css={{ ...css.base, ...variantCss }}
      onClick={handleClick}
      aria-pressed={state === 'selected'}
      aria-disabled={state === 'disabled'}
      aria-label={ariaLabel}
    >
      {state === 'selected' ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M3 8.5L6.5 12L13 4.5"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  )
}
