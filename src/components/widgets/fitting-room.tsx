import { Text, TextT } from '@/components/text'
import { FittingRoomIcon } from '@/lib/asset'
import { getLogger } from '@/lib/logger'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { WidgetProps } from '@/lib/view'
import { OverlayName } from '@/lib/view'

const logger = getLogger('widgets/fitting-room')

export default function FittingRoomWidget(_props: WidgetProps) {
  const count = useMainStore((state) => state.fittingRoom.length)
  const openOverlay = useMainStore((state) => state.openOverlay)

  const css = useCss((theme) => ({
    button: {
      marginTop: '10px',
      marginBottom: '10px',
      width: '100%',
      maxWidth: '440px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '13px',
      backgroundColor: 'white',
      borderWidth: '1px',
      borderColor: theme.color_fg_text,
      borderStyle: 'solid',
      borderRadius: '30px',
      cursor: 'pointer',
    },
    icon: {
      color: theme.color_fg_text,
      width: '20px',
      height: '20px',
    },
    text: {
      fontSize: '14px',
      textTransform: 'uppercase',
    },
    badge: {
      fontSize: '14px',
      fontWeight: 'bold',
      minWidth: '22px',
      height: '22px',
      padding: '0 6px',
      borderRadius: '11px',
      backgroundColor: theme.color_fg_text,
      color: '#FFFFFF',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }))

  const handleClick = () => {
    logger.logDebug('{{ts}} - Opening fitting room overlay', { count })
    openOverlay(OverlayName.FITTING_ROOM)
  }

  return (
    <button type="button" onClick={handleClick} css={css.button}>
      <FittingRoomIcon css={css.icon} />
      <TextT variant="base" css={css.text} t="view_fitting_room" />
      {count > 0 && (
        <Text variant="base" css={css.badge}>
          {count}
        </Text>
      )}
    </button>
  )
}
