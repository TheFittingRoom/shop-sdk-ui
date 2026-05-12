import { FitClassification, SizeFit } from '@/lib/api'

export interface VtoSizeColorData {
  colorwaySizeAssetId: number
  colorLabel: string | null
  sku: string
  priceFormatted: string
}

export interface VtoSizeData {
  sizeId: number
  sizeLabel: string
  isRecommended: boolean
  fit: SizeFit
  colors: VtoSizeColorData[]
}

export interface VtoProductData {
  productName: string
  productDescriptionHtml: string
  fitClassification: FitClassification
  recommendedSizeId: number
  recommendedSizeLabel: string
  sizes: VtoSizeData[]
  styleCategoryLabel: string | null
}
