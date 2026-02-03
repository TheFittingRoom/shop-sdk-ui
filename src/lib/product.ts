import {
  getSizeRecommendation as apiGetSizeRecommendation,
  FitClassification,
  MeasurementLocationFit,
  SizeFit,
  SizeFitRecommendation,
} from '@/lib/api'
import {
  getStyleByExternalId,
  getStyleGarmentCategoryById,
  FirestoreStyle,
  FirestoreStyleGarmentCategory,
} from '@/lib/database'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'

export type { FitClassification, MeasurementLocationFit, SizeFit, SizeFitRecommendation }

export type Style = FirestoreStyle
export type StyleGarmentCategory = FirestoreStyleGarmentCategory

export interface LoadedProductData {
  externalId: string
  style: Style
  styleGarmentCategory: StyleGarmentCategory
  sizeFitRecommendation: SizeFitRecommendation
}
export interface LoadedProductError {
  externalId: string
  error: Error
}

const logger = getLogger('product')

export function _init() {
  // Preload data for the current product
  const { currentProduct } = getStaticData()
  loadProductDataToStore(currentProduct.externalId)
}

export async function loadProductData(externalId: string): Promise<LoadedProductData> {
  const { brandId } = getStaticData()

  // Load style
  const style = await getStyleByExternalId(brandId, externalId)
  if (!style) {
    throw new Error(`Style not found for externalId: ${externalId}`)
  }

  // Load style garment category and size fit recommendation in parallel
  const [styleGarmentCategory, sizeFitRecommendation] = await Promise.all([
    getStyleGarmentCategoryById(style.style_garment_category_id),
    apiGetSizeRecommendation(style.id),
  ])
  if (!styleGarmentCategory) {
    throw new Error(
      `StyleGarmentCategory not found for externalId: ${externalId} style_garment_category_id: ${style.style_garment_category_id}`,
    )
  }

  return {
    externalId,
    style,
    styleGarmentCategory,
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
