import { useEffect, useState } from 'react'
import { getSizeRecommendation as fetchSizeRecommendation } from '@/lib/api'
import { getStyleByExternalId } from '@/lib/database'
import { getStaticData, useMainStore } from '@/lib/store'

export async function getSizeRecommendation(brandId: number, productExternalId: string): Promise<string | null> {
  const style = await getStyleByExternalId(brandId, productExternalId)
  if (!style) {
    return null
  }
  const styleId = style.id
  const recommendation = await fetchSizeRecommendation(styleId)
  return recommendation.recommended_size.label
}

export function useSizeRecommendation(): string | null {
  const [recommendedSize, setRecommendedSize] = useState<string | null>(null)
  const { brandId, productExternalId } = getStaticData()
  const { userHasAvatar } = useMainStore()

  useEffect(() => {
    if (!userHasAvatar) {
      return
    }
    async function fetchSizeRec() {
      try {
        const size = await getSizeRecommendation(brandId, productExternalId)
        setRecommendedSize(size)
      } catch (error) {
        console.error('[TFR] Error fetching size recommendation:', error)
        setRecommendedSize(null)
      }
    }
    fetchSizeRec()
  }, [brandId, productExternalId, userHasAvatar])

  return recommendedSize
}
