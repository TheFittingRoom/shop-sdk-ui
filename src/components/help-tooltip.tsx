import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Text } from '@/components/text'
import type { HelpTipId } from '@/lib/help-tips'
import { useHelpTip } from '@/lib/help-tips'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

export type HelpTooltipPlacement = 'below' | 'above'

interface HelpTooltipProps {
  text: string
  dismissAriaLabel: string
  onDismiss: () => void
  anchorRef: RefObject<HTMLElement | null>
  // Which side of the anchor the tooltip sits on; the arrow points back at
  // the anchor. Defaults to below.
  placement?: HelpTooltipPlacement
}

const TOOLTIP_WIDTH = 240
const VIEWPORT_PADDING = 12
const ARROW_WIDTH = 32
const ARROW_HEIGHT = 16
const ARROW_GAP = 14

interface TooltipPosition {
  left: number
  // Distance from the viewport top (below) or bottom (above) edge.
  offset: number
  arrowLeft: number
}

function computePosition(rect: DOMRect, placement: HelpTooltipPlacement): TooltipPosition {
  const anchorCentre = rect.left + rect.width / 2
  let left = anchorCentre - TOOLTIP_WIDTH / 2
  const maxLeft = window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING
  if (left > maxLeft) {
    left = maxLeft
  }
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING
  }
  const offset = placement === 'below' ? rect.bottom + ARROW_GAP : window.innerHeight - rect.top + ARROW_GAP
  // The arrow centres on the anchor — independent of where the tooltip body
  // ended up after clamping.
  const arrowLeftRaw = anchorCentre - left - ARROW_WIDTH / 2
  const arrowLeft = Math.max(8, Math.min(TOOLTIP_WIDTH - ARROW_WIDTH - 8, arrowLeftRaw))
  return { left, offset, arrowLeft }
}

function samePosition(a: TooltipPosition | null, b: TooltipPosition): boolean {
  return !!a && a.left === b.left && a.offset === b.offset && a.arrowLeft === b.arrowLeft
}

// HelpTooltip is a small popup with an arrow pointing at an arbitrary element
// (passed via anchorRef). Whether it shows, and dismissing it, is up to the
// caller — usually via useHelpTip, or the HelpTip wrapper below.
//
// Positioned with `position: fixed` against the anchor's screen rect so it can
// centre on the anchor, then clamped to keep both edges inside the viewport.
// The position is re-read every animation frame while it is up: anchors
// inside the overlays move without any resize or scroll event (the mobile
// sheet animates its height), and a tooltip is only ever up for seconds.
export function HelpTooltip({ text, dismissAriaLabel, onDismiss, anchorRef, placement = 'below' }: HelpTooltipProps) {
  const [pos, setPos] = useState<TooltipPosition | null>(null)

  useEffect(() => {
    let frame = 0
    const track = () => {
      const anchor = anchorRef.current
      if (anchor) {
        const next = computePosition(anchor.getBoundingClientRect(), placement)
        setPos((prev) => (samePosition(prev, next) ? prev : next))
      }
      frame = window.requestAnimationFrame(track)
    }
    track()
    return () => window.cancelAnimationFrame(frame)
  }, [anchorRef, placement])

  const css = useCss((theme) => ({
    wrapper: {
      position: 'fixed',
      width: `${TOOLTIP_WIDTH}px`,
      zIndex: 2147483645,
      fontFamily: theme.font_family,
    },
    arrow: {
      position: 'absolute',
      width: `${ARROW_WIDTH}px`,
      height: `${ARROW_HEIGHT}px`,
      color: theme.color_tfr_800,
      pointerEvents: 'none',
    },
    arrowBelow: {
      top: `-${ARROW_HEIGHT - 1}px`,
    },
    arrowAbove: {
      bottom: `-${ARROW_HEIGHT - 1}px`,
      transform: 'rotate(180deg)',
    },
    body: {
      backgroundColor: '#FFFFFF',
      color: theme.color_tfr_800,
      border: `2px solid ${theme.color_tfr_800}`,
      padding: '6px 10px',
      borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
    },
    text: {
      flex: 1,
      fontSize: '13px',
      lineHeight: '1.4',
      color: theme.color_tfr_800,
      textAlign: 'center',
    },
    closeBtn: {
      width: '20px',
      height: '20px',
      borderRadius: '10px',
      border: 'none',
      backgroundColor: 'transparent',
      color: theme.color_tfr_800,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
    },
  }))

  if (!pos) {
    return null
  }

  const edge = placement === 'below' ? { top: `${pos.offset}px` } : { bottom: `${pos.offset}px` }
  return (
    <div
      css={css.wrapper}
      style={{ left: `${pos.left}px`, ...edge }}
      role="dialog"
      aria-label={text}
      data-tfr-help-tooltip=""
    >
      <svg
        css={[css.arrow, placement === 'below' ? css.arrowBelow : css.arrowAbove]}
        style={{ left: `${pos.arrowLeft}px` }}
        viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <polygon points={`0,${ARROW_HEIGHT} ${ARROW_WIDTH / 2},0 ${ARROW_WIDTH},${ARROW_HEIGHT}`} fill="currentColor" />
      </svg>
      <div css={css.body}>
        <Text variant="base" css={css.text}>
          {text}
        </Text>
        <button css={css.closeBtn} onClick={onDismiss} aria-label={dismissAriaLabel}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// A popup that has been up this long has been seen.
const AUTO_DISMISS_MS = 10000

interface HelpTipProps {
  id: HelpTipId
  // The popup may show: its anchor is on screen and the hint makes sense now.
  enabled: boolean
  anchorRef: RefObject<HTMLElement | null>
  // Locale key of the popup text.
  t: string
  placement?: HelpTooltipPlacement
}

// HelpTip is a one-time help popup for the overlays. It shows when useHelpTip
// makes it the active popup, and is dismissed — and never shown again in this
// browser — by its close button, by the shopper touching anything else (most
// often the very control it points at), or after AUTO_DISMISS_MS.
//
// The store widgets drive HelpTooltip through useHelpTip directly instead,
// because they fold its dismissal into their own drawer handling.
export function HelpTip({ id, enabled, anchorRef, t: textKey, placement }: HelpTipProps) {
  const { t } = useTranslation()
  const { show, dismiss } = useHelpTip(id, enabled)
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss

  useEffect(() => {
    if (!show) {
      return
    }
    const timer = window.setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS)
    // Capture phase, so a control that stops propagation still counts. The
    // touch is not swallowed: the control under it still gets it.
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-tfr-help-tooltip]')) {
        return
      }
      dismissRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [show])

  if (!show) {
    return null
  }
  return (
    <HelpTooltip
      text={t(textKey)}
      dismissAriaLabel={t('help_tip.dismiss')}
      onDismiss={dismiss}
      anchorRef={anchorRef}
      placement={placement}
    />
  )
}
