import { useTfrShopContext } from '@contexts/tfr-shop-context'
import { type UseQueryOptions, type UseQueryResult, useQuery } from '@tanstack/react-query'
import type { FirestoreStyleCategory } from '@thefittingroom/sdk/dist/esm/types'
import { options } from 'preact'
import { queryKeys } from './query-keys'

export interface ColorwaySizeAsset {
  style_id: number
  colorway_id: number
  size_id: number
  sku: string
}

export const useStyleBySku = (sku: string, enabled?: boolean): UseQueryResult<FirestoreStyleCategory | null> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.style.bySku(sku),
    queryFn: async () => {
      if (!sku) return null

      try {
        const colorwaySizeAsset = await tfrShop.getColorwaySizeAssetFromSku(sku)
        const style = await tfrShop.getStyle(colorwaySizeAsset.style_id)
        return style
      } catch (error) {
        console.log('Failed to get style from SKU:', error)
        return null
      }
    },
    enabled: !!sku && enabled !== false,
    ...options,
  })
}

export const useStyleByBrandId = (
  brandStyleId: string,
  options?: Omit<UseQueryOptions<FirestoreStyleCategory | null>, 'queryKey' | 'queryFn'>,
): UseQueryResult<FirestoreStyleCategory | null> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.style.byBrandId(brandStyleId),
    queryFn: async () => {
      if (!brandStyleId) return null

      try {
        const style = await tfrShop.getStyleByBrandStyleId(brandStyleId)
        return style
      } catch (error) {
        console.log('Failed to get style from brand ID:', error)
        return null
      }
    },
    enabled: !!brandStyleId,
    ...options,
  })
}

export const useStyleFromSkuOrBrandId = (skuOrBrandId: string): UseQueryResult<FirestoreStyleCategory | null> => {
  const skuQuery = useStyleBySku(skuOrBrandId, !!skuOrBrandId)

  const brandIdQuery = useStyleByBrandId(skuOrBrandId, {
    enabled: !!skuOrBrandId && !skuQuery.data && skuQuery.isError,
    ...options,
  })

  return {
    data: skuQuery.data || brandIdQuery.data,
    error: brandIdQuery.isError ? brandIdQuery.error : skuQuery.error,
    isError: skuQuery.isError && brandIdQuery.isError,
    isPending: skuQuery.isPending || (skuQuery.isError && brandIdQuery.isPending),
    isSuccess: skuQuery.isSuccess || brandIdQuery.isSuccess,
    isFetching: skuQuery.isFetching || brandIdQuery.isFetching,
    refetch: async () => {
      const skuResult = await skuQuery.refetch()
      if (skuResult) return skuResult
      return brandIdQuery.refetch()
    },
  } as UseQueryResult<FirestoreStyleCategory | null>
}

export const useColorwaySizeAsset = (
  sku: string,
  options?: Omit<UseQueryOptions<ColorwaySizeAsset | null>, 'queryKey' | 'queryFn'>,
): UseQueryResult<ColorwaySizeAsset | null> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.colorway.sizeAsset(sku),
    queryFn: async () => {
      if (!sku) return null

      try {
        const asset = await tfrShop.getColorwaySizeAssetFromSku(sku)
        return asset
      } catch (error) {
        console.error('Failed to get colorway size asset:', error)
        return null
      }
    },
    enabled: !!sku,
    ...options,
  })
}
