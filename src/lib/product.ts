import type {
  FirestoreChildStyle,
  FirestoreColorwaySizeAsset,
  FirestoreSetSizeMapping,
  FirestoreSize,
} from '@/api/gen/responses'
import type {
  FitClassification,
  MeasurementLocationFit,
  SizeFit,
  SizeFitRecommendation,
  VtoCompositionItem,
} from '@/lib/api'
import { getSizeRecommendation as apiGetSizeRecommendation } from '@/lib/api'
import type { FirestoreStyle } from '@/lib/database'
import { getStyleByExternalId } from '@/lib/database'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'

export type { FitClassification, MeasurementLocationFit, SizeFit, SizeFitRecommendation }

export type Style = FirestoreStyle

// Container-style narrowed views. Tygo emits FirestoreStyle.children /
// set_size_mappings as `any[]` because Go's ToFirestoreStruct declares
// them as `[]interface{}` — but the runtime shape is
// FirestoreChildStyle[] / FirestoreSetSizeMapping[] respectively. Same
// story for the sibling embedded arrays (children[].sizes,
// children[].colorway_size_assets), which are structured but come
// through as `any[]`. Everything below assumes that runtime shape.
type FirestoreChildStyleWithNested = FirestoreChildStyle & {
  sizes?: FirestoreSize[]
  colorway_size_assets?: FirestoreColorwaySizeAsset[]
}

export interface ContainerStyleData {
  children: FirestoreChildStyleWithNested[]
  setSizeMappings: FirestoreSetSizeMapping[]
}

export interface LoadedProductData {
  externalId: string
  style: Style
  sizeFitRecommendation: SizeFitRecommendation
  /** Populated only when style.is_container === true. */
  container?: ContainerStyleData
}
export interface LoadedProductError {
  externalId: string
  error: Error
}

// --- VTO sizing view-model -------------------------------------------------
// VtoProductData is the display shape the shared leaf widgets (SizeSelector,
// ItemFitText, ItemFitDetails) consume. quick-view builds it from store
// product data; the fitting room builds it from a ResolvedFittingRoomItem
// (see buildVtoProductDataFromResolved in fitting-room-data.ts).

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

  const container = style.is_container
    ? {
        children: (style.children as FirestoreChildStyleWithNested[] | undefined) ?? [],
        setSizeMappings: (style.set_size_mappings as FirestoreSetSizeMapping[] | undefined) ?? [],
      }
    : undefined

  return {
    externalId,
    style,
    sizeFitRecommendation,
    container,
  }
}

/**
 * buildVtoWireItems is the shared helper for callsites that build a single
 * product's wire-request items from a chosen parent CSA. Returns 1 wire item
 * for single-garment products; N items for containers (one per expanded
 * child CSA, with `untucked` propagated to every entry).
 *
 * Returns null when the product is a container but expansion fails — caller
 * should skip the request rather than post an item pointing at the parent
 * CSA (backend rejects parent CSAs as VTO items).
 */
export function buildVtoWireItems(
  loaded: LoadedProductData,
  parentCsaId: number,
  untucked: boolean,
): VtoCompositionItem[] | null {
  const untuckFrag = untucked ? { untucked: true as const } : {}
  if (!loaded.container) {
    return [{ colorway_size_asset_id: parentCsaId, ...untuckFrag }]
  }
  const childCsaIds = resolveContainerExpansion(loaded, parentCsaId)
  if (!childCsaIds) {
    return null
  }
  return childCsaIds.map((csaId) => ({ colorway_size_asset_id: csaId, ...untuckFrag }))
}

/**
 * resolveContainerExpansion is the convenience wrapper for the wire-request
 * build path: given a loaded product and the shopper's chosen parent CSA id,
 * look up which parent Size + colorway that CSA belongs to (via the size-rec
 * response, which the SDK has cached at load time) and then walk the mappings
 * to N child CSAs.
 *
 * Returns null when the style isn't a container, when the parent CSA can't
 * be located on any size-rec row (stale storage), or when child expansion
 * fails (see resolveContainerChildCSAs). Callers treat null as "post the
 * single parent CSA as-is" (non-container path) OR "skip this outfit item"
 * (broken container), depending on which case null represents.
 */
export function resolveContainerExpansion(loaded: LoadedProductData, parentCsaId: number): number[] | null {
  if (!loaded.container) {
    return null
  }
  for (const sz of loaded.sizeFitRecommendation.available_sizes) {
    const csa = sz.colorway_size_assets.find((c) => c.id === parentCsaId)
    if (!csa || !csa.colorway_name) {
      continue
    }
    return resolveContainerChildCSAs(loaded.container, sz.id, csa.colorway_name)
  }
  return null
}

/**
 * resolveContainerChildCSAs walks the container's set_size_mappings and each
 * child's embedded sizes/colorway_size_assets to expand a shopper-selected
 * (parent size id, colorway id) into one child CSA id per component.
 *
 * Colorway resolution: parent colorway names are mirrored onto each child at
 * publish time (backend hook), so match a child's CSA by the parent-colorway
 * NAME rather than the parent colorway id — child colorways have their own
 * ids.
 *
 * Returns null if any child is missing a mapping or a matching CSA; the caller
 * treats null as "cannot render this container at the shopper's selection",
 * which usually means the merchant has an in-flight edit that broke coverage.
 */
export function resolveContainerChildCSAs(
  container: ContainerStyleData,
  parentSizeId: number,
  parentColorwayName: string,
): number[] | null {
  const relevantMappings = container.setSizeMappings.filter((m) => m.parent_size_id === parentSizeId)
  if (relevantMappings.length === 0) {
    return null
  }
  const csaIds: number[] = []
  for (const mapping of relevantMappings) {
    // Find the child that owns this child_size_id. Each child's sizes[]
    // is small (2-3 entries typical) so a nested find is fine.
    let matchedCsaId: number | null = null
    for (const child of container.children) {
      const size = (child.sizes ?? []).find((s) => s.id === mapping.child_size_id)
      if (!size) {
        continue
      }
      const csa = (child.colorway_size_assets ?? []).find(
        (a) => a.size_id === size.id && a.colorway_name === parentColorwayName,
      )
      if (csa) {
        matchedCsaId = csa.id
      }
      break
    }
    if (matchedCsaId == null) {
      return null
    }
    csaIds.push(matchedCsaId)
  }
  return csaIds
}

export function loadProductDataToStore(externalId: string): void {
  async function loadAndStore() {
    try {
      const productData = await loadProductData(externalId)
      useMainStore.getState().setProductData(productData.externalId, productData)
      logger.logDebug(`Loaded product data for externalId: ${externalId}`, { productData })
    } catch (error) {
      logger.logError(`Error loading product data for externalId: ${externalId}`, { error })
    }
  }
  const { userIsLoggedIn, userHasAvatar, productData } = useMainStore.getState()
  if (productData[externalId] || !userIsLoggedIn || userHasAvatar === false) {
    // Already loaded or cannot load yet
    return
  }
  void loadAndStore()
}
