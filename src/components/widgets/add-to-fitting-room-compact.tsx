import { FittingRoomIcon } from '@/lib/asset'
import { toggleFittingRoomItem } from '@/lib/fitting-room-storage'
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
  const attrProductHandle = attributes['product-handle'] as string | undefined
  const productId = attrProductId || currentProduct?.externalId || null
  const isPdp = productId != null && productId === currentProduct?.externalId
  const productHandle = attrProductHandle || (isPdp ? currentProduct?.handle ?? null : null)

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
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
    },
    buttonAdded: {
      backgroundColor: theme.color_fg_text,
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
    toggleFittingRoomItem(productId, productHandle, isPdp).catch((error) => {
      logger.logError('toggleFittingRoomItem failed', { error })
    })
  }

  const ariaLabel = t(isInFittingRoom ? 'added_to_fitting_room' : 'add_to_fitting_room')

  return (
    <button
      type="button"
      onClick={handleClick}
      css={[css.button, isInFittingRoom && css.buttonAdded]}
      aria-label={ariaLabel}
      aria-pressed={isInFittingRoom}
    >
      <FittingRoomIcon css={[css.icon, isInFittingRoom && css.iconAdded]} />
    </button>
  )
}
