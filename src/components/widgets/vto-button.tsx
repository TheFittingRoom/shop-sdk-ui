import { TextT } from '@/components/text'
import { TfrIcon } from '@/lib/asset'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { WidgetProps } from '@/lib/view'
import { OverlayName } from '@/lib/view'

const logger = getLogger('widgets/vto-button')

// PDP try-on CTA. When the shopper has other products waiting in the fitting
// room it routes to the multi-garment fitting-room overlay ("Try It On");
// otherwise it opens the single-garment quick-view ("Quick View Try On").
export default function VtoButtonWidget(_props: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)
  const currentProductId = getStaticData().currentProduct?.externalId ?? null
  // "Other" items = fitting-room entries that aren't the current product.
  const hasOtherFittingRoomItems = useMainStore((state) =>
    state.fittingRoom.some((item) => item.externalId !== currentProductId),
  )

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

  const handleClick = () => {
    if (hasOtherFittingRoomItems) {
      logger.logDebug('{{ts}} - Opening fitting-room overlay')
      openOverlay(OverlayName.FITTING_ROOM)
    } else {
      logger.logDebug('{{ts}} - Opening quick-view overlay')
      openOverlay(OverlayName.QUICK_VIEW)
    }
  }

  return (
    <button type="button" onClick={handleClick} css={css.button}>
      <TfrIcon css={css.icon} />
      <TextT variant="base" css={css.text} t={hasOtherFittingRoomItems ? 'try_it_on' : 'quick-view.title'} />
    </button>
  )
}
