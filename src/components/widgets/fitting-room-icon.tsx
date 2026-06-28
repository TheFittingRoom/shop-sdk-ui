import { keyframes } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FittingRoomIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { WidgetProps } from '@/lib/view'
import { OverlayName } from '@/lib/view'
import { AddConfirmationDrawer } from './add-confirmation-drawer'
import { FirstVisitTooltip } from './first-visit-tooltip'

const logger = getLogger('widgets/fitting-room-icon')

const DRAWER_AUTO_DISMISS_MS = 6000
const TOOLTIP_AUTO_DISMISS_MS = 10000
const FIRST_VISIT_KEY = 'tfr:first-visit-tooltip-seen:v1'

// Soft teal box-shadow pulse — only animates while the first-visit tooltip
// is showing. Reuses the #265A64 TFR teal (theme.color_tfr_800), the same
// colour the card-select toggle and selected-card border use.
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(38, 90, 100, 0.6); }
  70%  { box-shadow: 0 0 0 10px rgba(38, 90, 100, 0); }
  100% { box-shadow: 0 0 0 0 rgba(38, 90, 100, 0); }
`

export default function FittingRoomIconWidget(_props: WidgetProps) {
  const { t } = useTranslation()
  const count = useMainStore((state) => state.fittingRoom.length)
  const isOpen = useMainStore((state) => state.activeOverlay === OverlayName.FITTING_ROOM)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const lastAddEvent = useMainStore((state) => state.lastAddEvent)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const drawerAutoDismissTimerRef = useRef<number | null>(null)

  // First-visit detection. One-shot per browser via localStorage.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(FIRST_VISIT_KEY)) {
        setShowTooltip(true)
      }
    } catch (error) {
      logger.logWarn('Failed to read first-visit flag', { error })
    }
  }, [])

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false)
    try {
      window.localStorage.setItem(FIRST_VISIT_KEY, 'true')
    } catch (error) {
      logger.logWarn('Failed to write first-visit flag', { error })
    }
  }, [])

  // Auto-dismiss the tooltip after 10s — the shopper has had time to see it;
  // we still write the localStorage flag so it doesn't re-appear on the next
  // page load.
  useEffect(() => {
    if (!showTooltip) {
      return
    }
    const timer = window.setTimeout(dismissTooltip, TOOLTIP_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [showTooltip, dismissTooltip])

  const cancelDrawerAutoDismiss = useCallback(() => {
    if (drawerAutoDismissTimerRef.current !== null) {
      window.clearTimeout(drawerAutoDismissTimerRef.current)
      drawerAutoDismissTimerRef.current = null
    }
  }, [])

  // Fire the drawer on every add (timestamp changes even for re-adds of the
  // same externalId). Start the auto-dismiss timer in the same effect so a
  // second add resets it. Once the shopper interacts with the drawer (hover,
  // pointer, focus) the timer is cancelled — see cancelDrawerAutoDismiss
  // wired to the drawer below.
  useEffect(() => {
    if (!lastAddEvent) {
      return
    }
    setDrawerOpen(true)
    cancelDrawerAutoDismiss()
    drawerAutoDismissTimerRef.current = window.setTimeout(() => {
      setDrawerOpen(false)
      drawerAutoDismissTimerRef.current = null
    }, DRAWER_AUTO_DISMISS_MS)
    return cancelDrawerAutoDismiss
  }, [lastAddEvent, cancelDrawerAutoDismiss])

  // Click-outside dismisses both the drawer and the tooltip. Inside-clicks
  // (icon button itself, drawer rows, trash, CTA, tooltip close) sit inside
  // wrapperRef.
  useEffect(() => {
    if (!drawerOpen && !showTooltip) {
      return
    }
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (drawerOpen) {
          setDrawerOpen(false)
        }
        if (showTooltip) {
          dismissTooltip()
        }
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [drawerOpen, showTooltip, dismissTooltip])

  // When the user removes the last item from inside the drawer, dismiss it.
  useEffect(() => {
    if (drawerOpen && count === 0) {
      setDrawerOpen(false)
    }
  }, [drawerOpen, count])

  const css = useCss((theme) => ({
    wrapper: {
      position: 'relative',
      display: 'inline-block',
    },
    button: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '44px',
      height: '44px',
      padding: 0,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: 'inherit',
    },
    buttonPulsing: {
      borderRadius: '50%',
      animation: `${pulse} 1.8s ease-out infinite`,
    },
    icon: {
      width: '24px',
      height: '24px',
      color: theme.color_fg_text,
    },
    badge: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      minWidth: '18px',
      height: '18px',
      padding: '0 5px',
      borderRadius: '9px',
      backgroundColor: theme.color_fg_text,
      color: '#FFFFFF',
      fontSize: '11px',
      fontWeight: 'bold',
      lineHeight: '18px',
      textAlign: 'center',
    },
  }))

  const handleClick = () => {
    if (showTooltip) {
      dismissTooltip()
    }
    if (isOpen) {
      logger.logDebug('{{ts}} - Closing fitting room overlay', { count })
      closeOverlay()
      return
    }
    logger.logDebug('{{ts}} - Opening fitting room overlay', { count })
    openOverlay(OverlayName.FITTING_ROOM)
    setDrawerOpen(false)
  }

  const handleOpenFromDrawer = () => {
    openOverlay(OverlayName.FITTING_ROOM)
    setDrawerOpen(false)
  }

  return (
    <div ref={wrapperRef} css={css.wrapper}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        css={{ ...css.button, ...(showTooltip && !drawerOpen ? css.buttonPulsing : {}) }}
        aria-label={t('view_fitting_room')}
      >
        <FittingRoomIcon css={css.icon} />
        {count > 0 && <span css={css.badge}>{count}</span>}
      </button>
      {drawerOpen ? (
        <AddConfirmationDrawer
          onDismiss={() => setDrawerOpen(false)}
          onOpenOverlay={handleOpenFromDrawer}
          onInteract={cancelDrawerAutoDismiss}
        />
      ) : showTooltip ? (
        <FirstVisitTooltip onDismiss={dismissTooltip} anchorRef={buttonRef} />
      ) : null}
    </div>
  )
}
