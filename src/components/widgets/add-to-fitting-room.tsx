import { TextT } from '@/components/text'
import { FittingRoomIcon } from '@/lib/asset'
import { toggleFittingRoomItem } from '@/lib/fitting-room'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { WidgetProps } from '@/lib/view'

const logger = getLogger('widgets/add-to-fitting-room')

export default function AddToFittingRoomWidget({ attributes }: WidgetProps) {
  const { currentProduct } = getStaticData()
  const attrProductId = attributes['product-id'] as string | undefined
  const productId = attrProductId || currentProduct?.externalId || null
  const isPdp = productId != null && productId === currentProduct?.externalId

  const isInFittingRoom = useMainStore((state) =>
    productId == null ? false : state.fittingRoom.some((item) => item.externalId === productId),
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
      color: theme.color_fg_text,
      width: '20px',
      height: '20px',
    },
    text: {
      fontSize: '14px',
      textTransform: 'uppercase',
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

  return (
    <button type="button" onClick={handleClick} css={css.button}>
      <FittingRoomIcon css={css.icon} />
      <TextT
        variant="base"
        css={css.text}
        t={isInFittingRoom ? 'added_to_fitting_room' : 'add_to_fitting_room'}
      />
    </button>
  )
}
