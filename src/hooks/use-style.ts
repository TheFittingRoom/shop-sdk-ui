import type { TfrShop } from '@thefittingroom/sdk'
import type { FirestoreStyleCategory } from '@thefittingroom/sdk/dist/esm/types'
import { useStyleFromSkuOrBrandId } from './data/use-style-data'

interface UseStyleOptions {
  tfrShop?: TfrShop
  sku: string
}

interface UseStyleReturn {
  style: FirestoreStyleCategory | null
  isLoading: boolean
  error: string | null
  isPublished: boolean
}

export const useStyle = ({ sku }: UseStyleOptions): UseStyleReturn => {
  const { data: style, isPending, error } = useStyleFromSkuOrBrandId(sku)

  return {
    style,
    isLoading: isPending,
    error: error?.message || null,
    isPublished: style?.is_published || false,
  }
}
