import { useTfrShopContext } from '@contexts/tfr-shop-context'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export interface GarmentLocation {
  name: string
  value: number
  unit: string
}

export interface MeasurementLocationResult {
  locations: string[]
  garmentLocations: GarmentLocation[]
}

export const useGarmentLocationsBySku = (
  sku: string,
  filledLocations?: string[],
  enabled?: boolean,
): UseQueryResult<MeasurementLocationResult> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.garment.locations(sku, filledLocations),
    queryFn: async () => {
      if (!sku) return { locations: [], garmentLocations: [] }

      try {
        const locations = await tfrShop.getMeasurementLocationsFromSku(sku, filledLocations || [])

        const garmentLocations = locations.map((loc: string) => ({
          name: tfrShop.getMeasurementLocationName(loc),
          value: 0,
          unit: 'cm',
        }))

        return {
          locations,
          garmentLocations,
        }
      } catch (error) {
        console.error('Failed to get measurement locations from SKU:', error)
        return { locations: [], garmentLocations: [] }
      }
    },
    enabled: !!sku && enabled !== false,
  })
}

export const useGarmentLocationsByBrandId = (
  brandStyleId: string,
  filledLocations?: string[],
  enabled?: boolean,
): UseQueryResult<MeasurementLocationResult> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.garment.locationsByBrandId(brandStyleId),
    queryFn: async () => {
      if (!brandStyleId) return { locations: [], garmentLocations: [] }

      try {
        const style = await tfrShop.getStyleByBrandStyleId(brandStyleId)
        if (!style) {
          return { locations: [], garmentLocations: [] }
        }

        const locations = await tfrShop.getMeasurementLocationsFromBrandStyleId(style.id, filledLocations || [])

        const garmentLocations = locations.map((loc: string) => ({
          name: tfrShop.getMeasurementLocationName(loc),
          value: 0,
          unit: 'cm',
        }))

        return {
          locations,
          garmentLocations,
        }
      } catch (error) {
        console.error('Failed to get measurement locations from brand ID:', error)
        return { locations: [], garmentLocations: [] }
      }
    },
    enabled: !!brandStyleId && enabled !== false,
  })
}

export const useGarmentLocationsQuery = (
  sku: string,
  isLoggedIn: boolean,
  filledLocations?: string[],
  enabled?: boolean,
): UseQueryResult<MeasurementLocationResult> => {
  const skuQuery = useGarmentLocationsBySku(sku, filledLocations, enabled)
  const brandIdQuery = useGarmentLocationsByBrandId(sku, filledLocations, enabled)

  return {
    data: skuQuery.data?.locations.length ? skuQuery.data : brandIdQuery.data,
    error: brandIdQuery.isError ? brandIdQuery.error : skuQuery.error,
    isError: skuQuery.isError && (!isLoggedIn || brandIdQuery.isError),
    isPending: skuQuery.isPending || (skuQuery.isError && isLoggedIn && brandIdQuery.isPending),
    isSuccess: skuQuery.isSuccess || brandIdQuery.isSuccess,
    isFetching: skuQuery.isFetching || brandIdQuery.isFetching,
    refetch: async () => {
      const skuResult = await skuQuery.refetch()
      if (skuResult.data?.locations.length) return skuResult
      if (isLoggedIn) return brandIdQuery.refetch()
      return skuResult
    },
  } as UseQueryResult<MeasurementLocationResult>
}
