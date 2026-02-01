import { TextT } from '@/components/text'
import { TfrIcon } from '@/lib/asset'
import { getLogger } from '@/lib/logger'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName, WidgetProps } from '@/lib/view'

const logger = getLogger('widgets/vto-button')

export default function VtoButtonWidget({}: WidgetProps) {
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
      fill: theme.color_fg_text,
    },
    text: {
      fontSize: '14px',
      textTransform: 'uppercase',
    },
  }))

  const openVto = () => {
    logger.logDebug('{{ts}} - Opening VTO overlay')
    openOverlay(OverlayName.VTO_SINGLE)
  }

  return (
    <button
      type="button"
      onClick={openVto}
      css={css.button}
    >
      <TfrIcon css={css.icon} />
      <TextT variant="base" css={css.text} t="try_it_on" />
    </button>
  )
}
