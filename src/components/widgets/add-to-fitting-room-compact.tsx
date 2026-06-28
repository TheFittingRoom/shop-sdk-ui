import { keyframes } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FittingRoomIcon } from '@/lib/asset'
import { toggleFittingRoomItem } from '@/lib/fitting-room-storage'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { WidgetProps } from '@/lib/view'
import { FirstVisitTooltip } from './first-visit-tooltip'

const logger = getLogger('widgets/add-to-fitting-room-compact')

const FIRST_ADD_KEY = 'tfr:first-add-tooltip-seen:v1'
const TOOLTIP_AUTO_DISMISS_MS = 10000

// Module-level claim: catalog pages render N of these widgets (one per
// product card). Only the first instance to mount on a page run should
// surface the first-add tooltip — without this guard every card would race
// to show its own. Resets per SDK init (per page navigation).
let firstAddTooltipClaimed = false

// Soft teal box-shadow pulse — only animates while the first-add tooltip
// is showing. Matches the pulse on the header fitting-room icon.
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(38, 90, 100, 0.6); }
  70%  { box-shadow: 0 0 0 10px rgba(38, 90, 100, 0); }
  100% { box-shadow: 0 0 0 0 rgba(38, 90, 100, 0); }
`

export default function AddToFittingRoomCompactWidget({ attributes }: WidgetProps) {
  const { t } = useTranslation()
  const { currentProduct } = getStaticData()
  const attrProductId = attributes['product-id'] as string | undefined
  const attrProductHandle = attributes['product-handle'] as string | undefined
  const productId = attrProductId || currentProduct?.externalId || null
  const isPdp = productId != null && productId === currentProduct?.externalId
  const productHandle = attrProductHandle || (isPdp ? (currentProduct?.handle ?? null) : null)

  const isInFittingRoom = useMainStore((state) =>
    productId == null ? false : state.fittingRoom.some((item) => item.externalId === productId),
  )

  const [showTooltip, setShowTooltip] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Claim + show on first mount, only if no prior widget has already claimed
  // in this SDK lifetime and the localStorage flag isn't set.
  useEffect(() => {
    if (firstAddTooltipClaimed) {
      return
    }
    try {
      if (window.localStorage.getItem(FIRST_ADD_KEY)) {
        return
      }
    } catch (error) {
      logger.logWarn('Failed to read first-add tooltip flag', { error })
      return
    }
    firstAddTooltipClaimed = true
    setShowTooltip(true)
  }, [])

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false)
    try {
      window.localStorage.setItem(FIRST_ADD_KEY, 'true')
    } catch (error) {
      logger.logWarn('Failed to write first-add tooltip flag', { error })
    }
  }, [])

  // Auto-dismiss after 10s.
  useEffect(() => {
    if (!showTooltip) {
      return
    }
    const timer = window.setTimeout(dismissTooltip, TOOLTIP_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [showTooltip, dismissTooltip])

  // Click-outside dismisses too.
  useEffect(() => {
    if (!showTooltip) {
      return
    }
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        dismissTooltip()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showTooltip, dismissTooltip])

  const css = useCss((theme) => ({
    wrapper: {
      position: 'relative',
      display: 'inline-block',
    },
    button: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '36px',
      height: '36px',
      padding: 0,
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
    },
    buttonAdded: {
      backgroundColor: theme.color_fg_text,
    },
    buttonPulsing: {
      animation: `${pulse} 1.8s ease-out infinite`,
    },
    icon: {
      width: '24px',
      height: '24px',
      color: theme.color_fg_text,
    },
    iconAdded: {
      color: '#FFFFFF',
    },
  }))

  if (productId == null) {
    return null
  }

  const handleClick = () => {
    if (showTooltip) {
      dismissTooltip()
    }
    toggleFittingRoomItem(productId, productHandle, isPdp).catch((error) => {
      logger.logError('toggleFittingRoomItem failed', { error })
    })
  }

  const ariaLabel = t(isInFittingRoom ? 'added_to_fitting_room' : 'add_to_fitting_room')

  return (
    <div ref={wrapperRef} css={css.wrapper}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        css={[css.button, isInFittingRoom && css.buttonAdded, showTooltip && css.buttonPulsing]}
        aria-label={ariaLabel}
        aria-pressed={isInFittingRoom}
      >
        <FittingRoomIcon css={[css.icon, isInFittingRoom && css.iconAdded]} />
      </button>
      {showTooltip ? (
        <FirstVisitTooltip
          text={t('first_add_tooltip.body')}
          dismissAriaLabel={t('first_add_tooltip.dismiss')}
          onDismiss={dismissTooltip}
          anchorRef={buttonRef}
        />
      ) : null}
    </div>
  )
}
