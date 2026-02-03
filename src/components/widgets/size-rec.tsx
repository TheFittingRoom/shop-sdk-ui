import { useCallback, useMemo } from 'react'
import { LinkT } from '@/components/link'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { getSizeLabelFromSize } from '@/lib/util'
import { OverlayName, WidgetProps } from '@/lib/view'

const logger = getLogger('size-rec')

export default function SizeRecWidget({}: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)
  const openedOverlays = useMainStore((state) => state.openedOverlays)
  const storeProductData = useMainStore((state) => state.productData)
  const hasOpenedVtoSingleOverlay = openedOverlays.includes(OverlayName.VTO_SINGLE)

  // Get size recommendation
  const sizeRecommendationRecord = useMemo(() => {
    const { currentProduct } = getStaticData()
    const { externalId } = currentProduct
    const productData = storeProductData[externalId]
    if (!productData) {
      return null
    }
    if ('error' in productData) {
      logger.logError('Error loading size recommendation:', { error: productData.error })
      return null
    }
    return productData.sizeFitRecommendation || null
  }, [storeProductData])

  const handleLinkClick = useCallback(() => {
    openOverlay(OverlayName.VTO_SINGLE)
  }, [openOverlay])

  // RENDERING:

  if (!sizeRecommendationRecord || !hasOpenedVtoSingleOverlay) {
    return null
  }
  const sizeLabel = getSizeLabelFromSize(sizeRecommendationRecord.recommended_size)
  if (!sizeLabel) {
    return null
  }

  return <LinkT onClick={handleLinkClick} variant="brand" t="size-rec.recommended_size" vars={{ size: sizeLabel }} />
}
