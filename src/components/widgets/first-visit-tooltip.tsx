import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import { Text } from '@/components/text'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

interface FirstVisitTooltipProps {
  onDismiss: () => void
  anchorRef: RefObject<HTMLElement | null>
}

const TOOLTIP_WIDTH = 240
const VIEWPORT_PADDING = 12
const ARROW_WIDTH = 32
const ARROW_HEIGHT = 16
const ARROW_GAP = 14

// Tooltip anchored beneath the fitting-room icon, shown once per browser
// (first time the icon mounts; dismissed by click on icon, close button, or
// click outside — see fitting-room-icon.tsx for the dismiss wiring).
//
// Positioned with `position: fixed` against the icon's screen rect so we can
// horizontally centre the tooltip under the icon, then clamp to keep both
// edges inside the viewport with a small padding. The arrow then re-anchors
// to the icon's centre regardless of where the tooltip ended up.
export function FirstVisitTooltip({ onDismiss, anchorRef }: FirstVisitTooltipProps) {
  const { t } = useTranslation()
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number } | null>(null)

  useEffect(() => {
    const compute = () => {
      const anchor = anchorRef.current
      if (!anchor) {
        return
      }
      const rect = anchor.getBoundingClientRect()
      const iconCentre = rect.left + rect.width / 2
      let left = iconCentre - TOOLTIP_WIDTH / 2
      const maxLeft = window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING
      if (left > maxLeft) {
        left = maxLeft
      }
      if (left < VIEWPORT_PADDING) {
        left = VIEWPORT_PADDING
      }
      const top = rect.bottom + ARROW_GAP
      // Arrow centres on the icon — independent of where the tooltip
      // body ended up after clamping.
      const arrowLeftRaw = iconCentre - left - ARROW_WIDTH / 2
      const arrowLeftClamped = Math.max(8, Math.min(TOOLTIP_WIDTH - ARROW_WIDTH - 8, arrowLeftRaw))
      setPos({ left, top, arrowLeft: arrowLeftClamped })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [anchorRef])

  const css = useCss((theme) => ({
    wrapper: {
      position: 'fixed',
      width: `${TOOLTIP_WIDTH}px`,
      zIndex: 2147483645,
      fontFamily: theme.font_family,
    },
    arrow: {
      position: 'absolute',
      top: `-${ARROW_HEIGHT - 1}px`,
      width: `${ARROW_WIDTH}px`,
      height: `${ARROW_HEIGHT}px`,
      color: theme.color_tfr_800,
      pointerEvents: 'none',
    },
    body: {
      backgroundColor: theme.color_tfr_800,
      color: '#FFFFFF',
      padding: '12px 14px',
      borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '4px',
    },
    text: {
      flex: 1,
      fontSize: '13px',
      lineHeight: '1.4',
      color: '#FFFFFF',
    },
    closeBtn: {
      width: '20px',
      height: '20px',
      borderRadius: '10px',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#F0F0F0',
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

  return (
    <div
      css={css.wrapper}
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      role="dialog"
      aria-label={t('first_visit_tooltip.body')}
    >
      <svg
        css={css.arrow}
        style={{ left: `${pos.arrowLeft}px` }}
        viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <polygon points={`0,${ARROW_HEIGHT} ${ARROW_WIDTH / 2},0 ${ARROW_WIDTH},${ARROW_HEIGHT}`} fill="currentColor" />
      </svg>
      <div css={css.body}>
        <Text variant="base" css={css.text}>
          {t('first_visit_tooltip.body')}
        </Text>
        <button css={css.closeBtn} onClick={onDismiss} aria-label={t('first_visit_tooltip.dismiss')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
