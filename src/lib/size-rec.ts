import { useEffect, useState } from 'react'
import { MeasurementLocationFit, SizeFit, SizeFitRecommendation } from '@/api/gen/responses'
import { getSizeRecommendation } from '@/lib/api'
import { getStyleByExternalId } from '@/lib/database'
import { getStaticData, useMainStore } from '@/lib/store'

export type { MeasurementLocationFit, SizeFit, SizeFitRecommendation }

export function useSizeRecommendation(load: boolean): {
  record: SizeFitRecommendation | null
  isLoading: boolean
  error: Error | null
} {
  const [record, setRecord] = useState<SizeFitRecommendation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { userHasAvatar } = useMainStore()

  useEffect(() => {
    if (!load || !userHasAvatar) {
      return
    }
    async function fetchSizeRec() {
      const { brandId, currentProduct } = getStaticData()
      try {
        setRecord(null)
        setIsLoading(true)
        setError(null)
        const style = await getStyleByExternalId(brandId, currentProduct.externalId)
        if (!style) {
          throw new Error('Style not found')
        }
        const sizeRecommendationRecord = await getSizeRecommendation(style.id)
        setRecord(sizeRecommendationRecord)
      } catch (error) {
        // logger.logError('Error fetching size recommendation:', error)
        setError(error as Error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSizeRec()
  }, [load, userHasAvatar])

  return { record, isLoading, error }
}
