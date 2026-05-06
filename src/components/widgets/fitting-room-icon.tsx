import { FittingRoomIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName, WidgetProps } from '@/lib/view'

const logger = getLogger('widgets/fitting-room-icon')

export default function FittingRoomIconWidget({}: WidgetProps) {
  const { t } = useTranslation()
  const count = useMainStore((state) => state.fittingRoom.length)
  const isOpen = useMainStore((state) => state.activeOverlay === OverlayName.FITTING_ROOM)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)

  const css = useCss((theme) => ({
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
    if (isOpen) {
      logger.logDebug('{{ts}} - Closing fitting room overlay', { count })
      closeOverlay()
      return
    }
    logger.logDebug('{{ts}} - Opening fitting room overlay', { count })
    openOverlay(OverlayName.FITTING_ROOM)
  }

  return (
    <button type="button" onClick={handleClick} css={css.button} aria-label={t('view_fitting_room')}>
      <FittingRoomIcon css={css.icon} />
      {count > 0 && <span css={css.badge}>{count}</span>}
    </button>
  )
}
