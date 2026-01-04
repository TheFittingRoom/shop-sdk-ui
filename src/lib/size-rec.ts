import { useEffect, useState } from 'react'
import { MeasurementLocationFit, SizeFit, SizeFitRecommendation } from '@/api/gen/responses'
import { getSizeRecommendation } from '@/lib/api'
import { getStyleByExternalId } from '@/lib/database'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'

export type { MeasurementLocationFit, SizeFit, SizeFitRecommendation }

const logger = getLogger('size-rec')

export function useSizeRecommendation(load: boolean): SizeFitRecommendation | null {
  const [recommendedSize, setRecommendedSize] = useState<SizeFitRecommendation | null>(null)
  const { brandId, currentProduct } = getStaticData()
  const { userHasAvatar } = useMainStore()

  useEffect(() => {
    if (!load || !userHasAvatar) {
      return
    }
    async function fetchSizeRec() {
      try {
        const style = await getStyleByExternalId(brandId, currentProduct.externalId)
        if (!style) {
          throw new Error('Style not found')
        }
        const sizeRecommendationRecord = await getSizeRecommendation(style.id)
        setRecommendedSize(sizeRecommendationRecord)
      } catch (error) {
        logger.logError('Error fetching size recommendation:', error)
        setRecommendedSize(null)
      }
    }
    fetchSizeRec()
  }, [load, brandId, currentProduct, userHasAvatar])

  return recommendedSize
}
