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
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'

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
