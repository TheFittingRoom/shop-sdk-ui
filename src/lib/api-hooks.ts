import { useEffect, useState } from 'react'
import { getSizeRecommendation as apiGetSizeRecommendation, SizeFitRecommendation } from '@/lib/api'
import { getStyleByExternalId } from '@/lib/database'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'

export type { SizeFitRecommendation }

const logger = getLogger('api-hooks')

export async function getSizeRecommendation(
  brandId: number,
  productExternalId: string,
): Promise<SizeFitRecommendation | null> {
  const style = await getStyleByExternalId(brandId, productExternalId)
  if (!style) {
    return null
  }
  return await apiGetSizeRecommendation(style.id)
}

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
        const sizeRecommendation = await getSizeRecommendation(brandId, currentProduct.externalId)
        setRecommendedSize(sizeRecommendation)
      } catch (error) {
        logger.logError('Error fetching size recommendation:', error)
        setRecommendedSize(null)
      }
    }
    fetchSizeRec()
  }, [load, brandId, currentProduct, userHasAvatar])

  return recommendedSize
}
