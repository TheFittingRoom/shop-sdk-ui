import { keyframes } from '@emotion/react'
import { useEffect, useRef, useState } from 'react'
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

const DRAWER_AUTO_DISMISS_MS = 4000
const FIRST_VISIT_KEY = 'tfr:first-visit-tooltip-seen:v1'

// Soft green box-shadow pulse — only animates while the first-visit tooltip
// is showing. Reuses the #22C55E green from the card-select badge / checkbox
// (the only attention colour in the SDK today).
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
  70%  { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
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

  const dismissTooltip = () => {
    setShowTooltip(false)
    try {
      window.localStorage.setItem(FIRST_VISIT_KEY, 'true')
    } catch (error) {
      logger.logWarn('Failed to write first-visit flag', { error })
    }
  }

  // Fire the drawer on every add (timestamp changes even for re-adds of the
  // same externalId). Start the auto-dismiss timer in the same effect so a
  // second add resets it.
  useEffect(() => {
    if (!lastAddEvent) {
      return
    }
    setDrawerOpen(true)
    const timer = window.setTimeout(() => setDrawerOpen(false), DRAWER_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [lastAddEvent])

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
  }, [drawerOpen, showTooltip])

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
        type="button"
        onClick={handleClick}
        css={{ ...css.button, ...(showTooltip && !drawerOpen ? css.buttonPulsing : {}) }}
        aria-label={t('view_fitting_room')}
      >
        <FittingRoomIcon css={css.icon} />
        {count > 0 && <span css={css.badge}>{count}</span>}
      </button>
      {drawerOpen ? (
        <AddConfirmationDrawer onDismiss={() => setDrawerOpen(false)} onOpenOverlay={handleOpenFromDrawer} />
      ) : showTooltip ? (
        <FirstVisitTooltip onDismiss={dismissTooltip} />
      ) : null}
    </div>
  )
}
