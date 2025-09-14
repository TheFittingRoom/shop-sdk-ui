import { useTfrShopContext } from '@contexts/tfr-shop-context'
import { type UseQueryOptions, type UseQueryResult, useQuery } from '@tanstack/react-query'
import { types as ShopTypes } from '@thefittingroom/sdk'
import { options } from 'preact'
import { queryKeys } from './query-keys'

export interface SizeLocation {
  location: string
  fit: string
  isPerfect: boolean
}

export interface SizeWithLocations {
  size: string
  size_id: number
  locations: SizeLocation[]
}

export interface SizeRecommendation {
  recommended: string
  recommended_size_id: number
  sizes: SizeWithLocations[]
  available_sizes: any[]
  fits: any[]
}

const perfectFits = [ShopTypes.Fit.PERFECT_FIT, ShopTypes.Fit.SLIGHTLY_LOOSE, ShopTypes.Fit.SLIGHTLY_TIGHT]

export const useRecommendedSizes = (styleId: string | number): UseQueryResult<SizeRecommendation | null> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.recommendation.sizes(styleId),
    queryFn: async () => {
      if (!styleId) return null

      try {
        const sizeRec = await tfrShop.getRecommendedSizes(String(styleId))

        if (!sizeRec || !sizeRec.fits || !sizeRec.available_sizes) {
          return null
        }

        const sizeMap = new Map<string, { size_id: number; locations: SizeLocation[] }>()

        for (const fit of sizeRec.fits) {
          const size = sizeRec.available_sizes.find((s: any) => s.id === fit.size_id)
          const sizeName = size?.size_value?.name || 'Unknown'

          if (!sizeMap.has(sizeName)) {
            sizeMap.set(sizeName, {
              size_id: fit.size_id,
              locations: [],
            })
          }

          const sizeData = sizeMap.get(sizeName)!
          for (const locFit of fit.measurement_location_fits || []) {
            sizeData.locations.push({
              location: locFit.measurement_location,
              fit: locFit.fit_label || locFit.fit || 'Unknown',
              isPerfect: perfectFits.includes(locFit.fit),
            })
          }
        }

        const sizes = Array.from(sizeMap.entries()).map(([sizeName, data]) => ({
          size: sizeName,
          size_id: data.size_id,
          locations: data.locations,
        }))

        return {
          recommended: sizeRec.recommended_size?.size_value?.name || 'Unknown',
          recommended_size_id: sizeRec.recommended_size?.size_value?.id || sizes[0]?.size_id,
          sizes,
          available_sizes: sizeRec.available_sizes,
          fits: sizeRec.fits,
        }
      } catch (error) {
        console.error('Failed to get size recommendations:', error)
        return null
      }
    },
    enabled: !!styleId,
    ...options,
  })
}

export const usePerfectFitSize = (
  styleId: string | number,
  options?: Omit<UseQueryOptions<SizeWithLocations | null>, 'queryKey' | 'queryFn'>,
): UseQueryResult<SizeWithLocations | null> => {
  const { data: recommendation } = useRecommendedSizes(styleId)

  return useQuery({
    queryKey: [...queryKeys.recommendation.sizes(styleId), 'perfect-fit'],
    queryFn: async () => {
      if (!recommendation) return null

      const perfectFitSize = recommendation.sizes.find((s) => s.locations.some((l) => l.isPerfect))

      return perfectFitSize || null
    },
    enabled: !!recommendation,
    ...options,
  })
}
