import { useSizeRecContext } from '@contexts/size-rec-context'

import { useAuthStatus } from './data/use-auth-data'
import { useGarmentLocationsQuery } from './data/use-garment-data'

export interface GarmentLocation {
  name: string
  value: number
  unit: string
}

export const useGarmentLocations = () => {
  const { sku } = useSizeRecContext()
  const { data: authStatus } = useAuthStatus()
  const isLoggedIn = authStatus?.isLoggedIn || false

  const { data, isPending, error } = useGarmentLocationsQuery(sku, isLoggedIn, undefined, !!sku)

  return {
    garmentLocations: data?.garmentLocations || [],
    isLoading: isPending,
    error: error?.message || null,
  }
}
