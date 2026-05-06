import { FittingRoomIcon } from '@/lib/asset'
import { toggleFittingRoomItem } from '@/lib/fitting-room'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { WidgetProps } from '@/lib/view'

const logger = getLogger('widgets/add-to-fitting-room-compact')

export default function AddToFittingRoomCompactWidget({ attributes }: WidgetProps) {
  const { t } = useTranslation()
  const { currentProduct } = getStaticData()
  const attrProductId = attributes['product-id'] as string | undefined
  const productId = attrProductId || currentProduct?.externalId || null
  const isPdp = productId != null && productId === currentProduct?.externalId

  const isInFittingRoom = useMainStore((state) =>
    productId == null ? false : state.fittingRoom.some((item) => item.externalId === productId),
  )

  const css = useCss((theme) => ({
    button: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '36px',
      height: '36px',
      padding: 0,
      backgroundColor: isInFittingRoom ? theme.color_fg_text : 'transparent',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
    },
    icon: {
      width: '24px',
      height: '24px',
      color: isInFittingRoom ? '#FFFFFF' : theme.color_fg_text,
    },
  }))

  if (productId == null) {
    return null
  }

  const handleClick = () => {
    toggleFittingRoomItem(productId, isPdp).catch((error) => {
      logger.logError('toggleFittingRoomItem failed', { error })
    })
  }

  const ariaLabel = t(isInFittingRoom ? 'added_to_fitting_room' : 'add_to_fitting_room')

  return (
    <button type="button" onClick={handleClick} css={css.button} aria-label={ariaLabel} aria-pressed={isInFittingRoom}>
      <FittingRoomIcon css={css.icon} />
    </button>
  )
}
