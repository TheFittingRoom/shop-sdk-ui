import { useEffect, useState } from 'react'
import { getSizeRecommendation as apiGetSizeRecommendation, SizeFitRecommendation } from '@/lib/api'
import { getStyleByExternalId } from '@/lib/database'
import { getStaticData, useMainStore } from '@/lib/store'

export type { SizeFitRecommendation }

export async function getSizeRecommendation(
  brandId: number,
  productExternalId: string,
): Promise<SizeFitRecommendation | null> {
  const style = await getStyleByExternalId(brandId, productExternalId)
  console.log('Fetched style for size recommendation:', style)
  if (!style) {
    return null
  }
  return await apiGetSizeRecommendation(style.id)
}

export function useSizeRecommendation(): SizeFitRecommendation | null {
  const [recommendedSize, setRecommendedSize] = useState<SizeFitRecommendation | null>(null)
  const { brandId, productExternalId } = getStaticData()
  const { userHasAvatar } = useMainStore()

  useEffect(() => {
    if (!userHasAvatar) {
      return
    }
    async function fetchSizeRec() {
      try {
        const sizeRecommendation = await getSizeRecommendation(brandId, productExternalId)
        setRecommendedSize(sizeRecommendation)
      } catch (error) {
        console.error('[TFR] Error fetching size recommendation:', error)
        setRecommendedSize(null)
      }
    }
    fetchSizeRec()
  }, [brandId, productExternalId, userHasAvatar])

  return recommendedSize
}
