import {
  getSizeRecommendation as apiGetSizeRecommendation,
  FitClassification,
  MeasurementLocationFit,
  SizeFit,
  SizeFitRecommendation,
} from '@/lib/api'
import {
  getStyleByExternalId,
  FirestoreStyle,
} from '@/lib/database'
import type { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { getSizeLabelFromSize } from '@/lib/util'

export type { FitClassification, MeasurementLocationFit, SizeFit, SizeFitRecommendation }

export type Style = FirestoreStyle

export interface LoadedProductData {
  externalId: string
  style: Style
  sizeFitRecommendation: SizeFitRecommendation
}
export interface LoadedProductError {
  externalId: string
  error: Error
}

// --- VTO sizing view-model -------------------------------------------------
// VtoProductData is the display shape the shared leaf widgets (SizeSelector,
// ItemFitText, ItemFitDetails) consume. It is adapted from a LoadedProductData
// (single-garment VTO) or a ResolvedFittingRoomItem (multi-garment) by the
// builders at the bottom of this file.

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

const logger = getLogger('product')

export function _init() {
  // Preload data for the current product
  useMainStore.subscribe((state, prevState) => {
    if (state.userHasAvatar && !prevState.userHasAvatar) {
      const { currentProduct } = getStaticData()
      if (currentProduct) {
        loadProductDataToStore(currentProduct.externalId)
      }
    }
  })
}

export async function loadProductData(externalId: string): Promise<LoadedProductData> {
  const { brandId } = getStaticData()

  // Load style
  const style = await getStyleByExternalId(brandId, externalId)
  if (!style) {
    throw new Error(`Style not found for externalId: ${externalId}`)
  }

  const sizeFitRecommendation = await apiGetSizeRecommendation(style.id)

  return {
    externalId,
    style,
    sizeFitRecommendation,
  }
}

export function loadProductDataToStore(externalId: string): void {
  async function loadAndStore() {
    try {
      const productData = await loadProductData(externalId)
      useMainStore.getState().setProductData(productData.externalId, productData)
      logger.logDebug(`Loaded product data for externalId: ${externalId}`, { productData });
    } catch (error) {
      logger.logError(`Error loading product data for externalId: ${externalId}`, { error })
    }
  }
  const { userIsLoggedIn, userHasAvatar, productData } = useMainStore.getState()
  if (productData[externalId] || !userIsLoggedIn || userHasAvatar === false) {
    // Already loaded or cannot load yet
    return
  }
  loadAndStore()
}

// --- VtoProductData builders ----------------------------------------------

// buildVtoProductDataFromResolved adapts a ResolvedFittingRoomItem (the
// fitting-room data layer's per-item view) into the VtoProductData shape that
// the shared leaf widgets (SizeSelector, ItemFitText, ItemFitDetails) consume.
// Returns null if the item hasn't loaded fully enough to display sizing info.
export function buildVtoProductDataFromResolved(
  item: ResolvedFittingRoomItem,
): VtoProductData | null {
  const { merchantProduct, loadedProduct } = item
  if (!merchantProduct || !loadedProduct) return null

  const sizeRec = loadedProduct.sizeFitRecommendation
  const recommendedSizeId = sizeRec.recommended_size.id || null
  const recommendedSizeLabel = getSizeLabelFromSize(sizeRec.recommended_size)
  if (recommendedSizeId == null || !recommendedSizeLabel) {
    logger.logWarn('Missing recommended size for item', { externalId: item.externalId })
    return null
  }

  const sizes: VtoSizeData[] = []
  for (const sizeRecord of sizeRec.available_sizes) {
    const sizeLabel = getSizeLabelFromSize(sizeRecord)
    if (!sizeLabel) continue
    const fit = sizeRec.fits.find((f) => f.size_id === sizeRecord.id)
    if (!fit) continue
    const colors: VtoSizeColorData[] = []
    for (const csa of sizeRecord.colorway_size_assets) {
      const variant = merchantProduct.variants.find((v) => v.sku === csa.sku)
      if (!variant) continue
      colors.push({
        colorwaySizeAssetId: csa.id,
        colorLabel: variant.color || null,
        sku: csa.sku,
        priceFormatted: variant.priceFormatted,
      })
    }
    if (colors.length === 0) continue
    sizes.push({
      sizeId: sizeRecord.id,
      sizeLabel,
      isRecommended: sizeRecord.id === recommendedSizeId,
      fit,
      colors,
    })
  }
  if (sizes.length === 0) return null

  return {
    productName: merchantProduct.productName,
    productDescriptionHtml: merchantProduct.productDescriptionHtml,
    fitClassification: sizeRec.fit_classification,
    recommendedSizeId,
    recommendedSizeLabel,
    sizes,
    styleCategoryLabel: item.styleCategory?.label_singular ?? loadedProduct.style.style_category_label ?? null,
  }
}

// findRecommendedColorSize returns the CSA + price for the recommended size
// using the currently-stored color preference, falling back to the first
// colorway when the preferred color is missing.
export function findRecommendedColorSize(
  data: VtoProductData,
  preferredColor: string | null,
): VtoSizeColorData | null {
  const recommended = data.sizes.find((s) => s.isRecommended)
  if (!recommended || recommended.colors.length === 0) return null
  return (
    recommended.colors.find((c) => c.colorLabel === preferredColor) ?? recommended.colors[0]
  )
}

// findCsaByLabel returns the CSA matching the given size label + color (or
// first color in that size when preferredColor is missing).
export function findCsaByLabel(
  data: VtoProductData,
  sizeLabel: string,
  preferredColor: string | null,
): VtoSizeColorData | null {
  const sizeRecord = data.sizes.find((s) => s.sizeLabel === sizeLabel)
  if (!sizeRecord || sizeRecord.colors.length === 0) return null
  return sizeRecord.colors.find((c) => c.colorLabel === preferredColor) ?? sizeRecord.colors[0]
}
