import { useEffect, useMemo, useState } from 'react'
import type { FittingRoomItem } from '@/lib/fitting-room-storage'
import { getLogger } from '@/lib/logger'
import type {
  LoadedProductData,
  LoadedProductError,
  VtoProductData,
  VtoSizeColorData,
  VtoSizeData,
} from '@/lib/product'
import { loadProductDataToStore, resolveContainerExpansion } from '@/lib/product'
import type { ExternalProduct, MerchantProductError } from '@/lib/store'
import { getStaticData, useMainStore } from '@/lib/store'
import type { StyleCategory, StyleCategoryGroup, StyleCategoryIndex } from '@/lib/style-categories'
import { loadStyleCategoryIndex, peekStyleCategoryIndex } from '@/lib/style-categories'
import { getSizeLabelFromSize } from '@/lib/util'

const logger = getLogger('fitting-room-data')

// Per-item effective (category, group) pairs. For single-garment items this
// is `[(item's own category, its group)]`; for container products it's one
// entry per child. The container category itself does NOT participate — it's
// a wrapper, not a garment category — so pairwise composition checks and
// garment-count arithmetic both key off this list. Emptied when the style
// category index isn't loaded yet or the category name isn't known to it.
export interface EffectiveCategory {
  category: StyleCategory
  group: StyleCategoryGroup | null
}

export interface ResolvedFittingRoomItem {
  externalId: string
  storage: FittingRoomItem
  merchantProduct: ExternalProduct | null
  merchantError: Error | null
  loadedProduct: LoadedProductData | null
  loadedError: Error | null
  // styleCategory / styleCategoryGroup are the PARENT's (or single-garment
  // item's own) category. Preserved for existing UI callsites (rail-card
  // header, accordion group). For composition rules and cap arithmetic use
  // `effective` below — that walks children for containers.
  styleCategory: StyleCategory | null
  styleCategoryGroup: StyleCategoryGroup | null
  effective: EffectiveCategory[]
  isReady: boolean
  needsResize: boolean
}

export interface ResolvedFittingRoomGroup {
  group: StyleCategoryGroup
  items: ResolvedFittingRoomItem[]
}

export interface ResolvedFittingRoom {
  items: ResolvedFittingRoomItem[]
  groups: ResolvedFittingRoomGroup[]
  ungrouped: ResolvedFittingRoomItem[]
  isLoading: boolean
  styleCategoryError: Error | null
}

// isItemTuckable returns true when at least one of the item's effective
// categories carries tuckable=true. For single-garment items this reduces to
// the item's own category; for containers it's true when any child garment
// is tuckable (shirt in a suit set, etc). Prefer this helper over reading
// `item.styleCategory.tuckable` directly — the latter is the PARENT
// category's flag, which is always falsy for containers.
export function isItemTuckable(item: ResolvedFittingRoomItem): boolean {
  return item.effective.some((e) => !!e.category.tuckable)
}

// loadFittingRoomData fans out all the per-item lookups required to render
// the fitting-room overlay. Idempotent: existing entries in the store are
// not re-fetched; missing handles are reported as per-item errors.
export async function loadFittingRoomData(): Promise<void> {
  const state = useMainStore.getState()
  const items = state.fittingRoom

  // Kick off the style-category index load (cached after first call).
  loadStyleCategoryIndex().catch((error) => {
    logger.logError('Failed to load style-category index', { error })
  })

  // Fan out TFR product loads (each is internally idempotent + gated on auth).
  for (const item of items) {
    loadProductDataToStore(item.externalId)
  }

  await loadMerchantProductData(items)
}

// Fan out merchant (Shopify, etc) productLookup in a single batch for items
// missing data. Idempotent: existing store entries are not re-fetched.
// Extracted from loadFittingRoomData so widgets that surface merchant info
// outside the overlay (e.g. the add-confirmation drawer) can trigger the
// same lookup without pulling in the TFR product/style-category loads.
export async function loadMerchantProductData(items: FittingRoomItem[]): Promise<void> {
  const state = useMainStore.getState()
  const { productLookup } = getStaticData()
  if (!productLookup) {
    for (const item of items) {
      if (state.merchantProductData[item.externalId]) {
        continue
      }
      state.setMerchantProductData(item.externalId, {
        error: new Error('No productLookup callback configured'),
      })
    }
    return
  }

  const itemsNeedingLookup = items.filter((item) => !state.merchantProductData[item.externalId])
  const itemsWithHandle = itemsNeedingLookup.filter(
    (item): item is FittingRoomItem & { handle: string } => !!item.handle,
  )
  const itemsWithoutHandle = itemsNeedingLookup.filter((item) => !item.handle)

  for (const item of itemsWithoutHandle) {
    state.setMerchantProductData(item.externalId, {
      error: new Error('Item has no handle (legacy localStorage entry — re-add to refresh)'),
    })
  }

  if (itemsWithHandle.length === 0) {
    return
  }

  const handles = itemsWithHandle.map((item) => item.handle)
  try {
    const products = await productLookup(handles)
    const byExternalId = new Map<string, ExternalProduct>()
    for (const p of products) {
      byExternalId.set(p.externalId, p)
    }
    for (const item of itemsWithHandle) {
      const product = byExternalId.get(item.externalId)
      if (product) {
        state.setMerchantProductData(item.externalId, product)
      } else {
        state.setMerchantProductData(item.externalId, {
          error: new Error(`Product not found in merchant lookup (handle: ${item.handle})`),
        })
      }
    }
  } catch (error) {
    logger.logError('productLookup batch failed', { error, handles })
    const wrapped = error instanceof Error ? error : new Error(String(error))
    for (const item of itemsWithHandle) {
      state.setMerchantProductData(item.externalId, { error: wrapped })
    }
  }
}

function isMerchantError(value: ExternalProduct | MerchantProductError | undefined): value is MerchantProductError {
  return !!value && 'error' in value
}

function isLoadedError(value: LoadedProductData | LoadedProductError | undefined): value is LoadedProductError {
  return !!value && 'error' in value
}

function resolveItem(
  item: FittingRoomItem,
  merchantSlot: ExternalProduct | MerchantProductError | undefined,
  loadedSlot: LoadedProductData | LoadedProductError | undefined,
  index: StyleCategoryIndex | null,
): ResolvedFittingRoomItem {
  const merchantProduct = merchantSlot && !isMerchantError(merchantSlot) ? merchantSlot : null
  const merchantError = merchantSlot && isMerchantError(merchantSlot) ? merchantSlot.error : null
  const loadedProduct = loadedSlot && !isLoadedError(loadedSlot) ? loadedSlot : null
  const loadedError = loadedSlot && isLoadedError(loadedSlot) ? loadedSlot.error : null

  let styleCategory: StyleCategory | null = null
  let styleCategoryGroup: StyleCategoryGroup | null = null
  const effective: EffectiveCategory[] = []
  if (loadedProduct && index) {
    const categoryName = String(loadedProduct.style.style_category_name)
    styleCategory = index.byName(categoryName)
    styleCategoryGroup = index.groupForCategory(categoryName)
    // Effective category set drives composition rules + garment-count cap.
    // Containers expand to one entry per child; the container's own
    // category (`suits_and_sets`) is a wrapper and does NOT participate.
    // Single-garment items contribute their own category.
    if (loadedProduct.container) {
      for (const child of loadedProduct.container.children) {
        const childName = String(child.style_category_name)
        const childCat = index.byName(childName)
        if (childCat) {
          effective.push({ category: childCat, group: index.groupForCategory(childName) })
        }
      }
    } else if (styleCategory) {
      effective.push({ category: styleCategory, group: styleCategoryGroup })
    }
  }

  // needsResize: csa is null OR csa is no longer in the current size rec.
  let needsResize = item.colorwaySizeAssetId == null
  if (!needsResize && loadedProduct && item.colorwaySizeAssetId != null) {
    const found = loadedProduct.sizeFitRecommendation.available_sizes.some((sz) =>
      sz.colorway_size_assets.some((csa) => csa.id === item.colorwaySizeAssetId),
    )
    if (!found) {
      needsResize = true
      logger.logDebug('csa no longer in size rec, marking needsResize', {
        externalId: item.externalId,
        csa: item.colorwaySizeAssetId,
      })
    }
    // Defensive: also re-validate that size label still resolves
    if (!needsResize && item.size) {
      const sizeStillExists = loadedProduct.sizeFitRecommendation.available_sizes.some(
        (sz) => getSizeLabelFromSize(sz) === item.size,
      )
      if (!sizeStillExists) {
        needsResize = true
      }
    }
    // Container-specific: the stored parent CSA may still be in size-rec
    // but the merchant might have deleted the corresponding set_size_mappings
    // rows between sessions. Attempt the expansion and mark needsResize if
    // it fails — surfacing the "pick a size" affordance is a better UX than
    // silently dropping the item at wire-build time.
    if (!needsResize && loadedProduct.container && item.colorwaySizeAssetId != null) {
      const expanded = resolveContainerExpansion(loadedProduct, item.colorwaySizeAssetId)
      if (!expanded) {
        needsResize = true
        logger.logDebug('container mapping resolved to empty, marking needsResize', {
          externalId: item.externalId,
          csa: item.colorwaySizeAssetId,
        })
      }
    }
  }

  const isReady = !!merchantProduct && !!loadedProduct && !!styleCategory && !needsResize

  return {
    externalId: item.externalId,
    storage: item,
    merchantProduct,
    merchantError,
    loadedProduct,
    loadedError,
    styleCategory,
    styleCategoryGroup,
    effective,
    isReady,
    needsResize,
  }
}

// useResolvedFittingRoom subscribes to fitting-room storage + per-item data
// slices + the cached style-category index, and re-derives a grouped view
// model whenever any source changes. Triggers loadFittingRoomData() on mount
// and whenever the fittingRoom array changes (idempotent — only fetches what
// isn't already cached).
export function useResolvedFittingRoom(): ResolvedFittingRoom {
  const fittingRoom = useMainStore((state) => state.fittingRoom)
  const productData = useMainStore((state) => state.productData)
  const merchantProductData = useMainStore((state) => state.merchantProductData)

  const [index, setIndex] = useState<StyleCategoryIndex | null>(() => peekStyleCategoryIndex())
  const [styleCategoryError, setStyleCategoryError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    loadStyleCategoryIndex()
      .then((idx) => {
        if (!cancelled) {
          setIndex(idx)
          setStyleCategoryError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStyleCategoryError(error instanceof Error ? error : new Error(String(error)))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Re-fetch (idempotently) whenever the fitting-room set changes.
  useEffect(() => {
    loadFittingRoomData().catch((error) => {
      logger.logError('loadFittingRoomData failed', { error })
    })
  }, [fittingRoom])

  return useMemo<ResolvedFittingRoom>(() => {
    const items = fittingRoom.map((item) =>
      resolveItem(item, merchantProductData[item.externalId], productData[item.externalId], index),
    )

    // isLoading: any item missing both merchant + loaded data, or style-category
    // index not yet loaded. Item-level errors don't count as "loading".
    const isLoading =
      !index || items.some((i) => (!i.merchantProduct && !i.merchantError) || (!i.loadedProduct && !i.loadedError))

    // Group items by style-category group, preserving group order from the index.
    const groups: ResolvedFittingRoomGroup[] = []
    const ungrouped: ResolvedFittingRoomItem[] = []
    if (index) {
      const groupBuckets = new Map<string, ResolvedFittingRoomItem[]>()
      for (const item of items) {
        if (item.styleCategoryGroup) {
          const key = item.styleCategoryGroup.name
          let bucket = groupBuckets.get(key)
          if (!bucket) {
            bucket = []
            groupBuckets.set(key, bucket)
          }
          bucket.push(item)
        } else {
          ungrouped.push(item)
        }
      }
      for (const group of index.groupsInOrder()) {
        const bucket = groupBuckets.get(group.name)
        if (bucket && bucket.length > 0) {
          groups.push({ group, items: bucket })
        }
      }
    } else {
      ungrouped.push(...items)
    }

    return {
      items,
      groups,
      ungrouped,
      isLoading,
      styleCategoryError,
    }
  }, [fittingRoom, productData, merchantProductData, index, styleCategoryError])
}

// --- VtoProductData adapters ----------------------------------------------
// Bridge the fitting-room data layer to the shared VTO sizing view-model
// (VtoProductData, defined in product.ts). These live here, not in product.ts,
// so the dependency stays one-way: fitting-room-data → product.

// buildVtoProductDataFromResolved adapts a ResolvedFittingRoomItem into the
// VtoProductData shape that the shared leaf widgets (SizeSelector, ItemFitText,
// ItemFitDetails) consume. Returns null if the item hasn't loaded fully enough
// to display sizing info.
export function buildVtoProductDataFromResolved(item: ResolvedFittingRoomItem): VtoProductData | null {
  const { merchantProduct, loadedProduct } = item
  if (!merchantProduct || !loadedProduct) {
    return null
  }

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
    if (!sizeLabel) {
      continue
    }
    const fit = sizeRec.fits.find((f) => f.size_id === sizeRecord.id)
    if (!fit) {
      continue
    }
    const colors: VtoSizeColorData[] = []
    for (const csa of sizeRecord.colorway_size_assets) {
      const variant = merchantProduct.variants.find((v) => v.sku === csa.sku)
      if (!variant) {
        continue
      }
      colors.push({
        colorwaySizeAssetId: csa.id,
        colorLabel: variant.color || null,
        sku: csa.sku,
        priceFormatted: variant.priceFormatted,
      })
    }
    if (colors.length === 0) {
      continue
    }
    sizes.push({
      sizeId: sizeRecord.id,
      sizeLabel,
      isRecommended: sizeRecord.id === recommendedSizeId,
      fit,
      colors,
    })
  }
  if (sizes.length === 0) {
    return null
  }

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
export function findRecommendedColorSize(data: VtoProductData, preferredColor: string | null): VtoSizeColorData | null {
  const recommended = data.sizes.find((s) => s.isRecommended)
  if (!recommended || recommended.colors.length === 0) {
    return null
  }
  return recommended.colors.find((c) => c.colorLabel === preferredColor) ?? recommended.colors[0]
}

// findCsaByLabel returns the CSA matching the given size label + color (or
// first color in that size when preferredColor is missing).
export function findCsaByLabel(
  data: VtoProductData,
  sizeLabel: string,
  preferredColor: string | null,
): VtoSizeColorData | null {
  const sizeRecord = data.sizes.find((s) => s.sizeLabel === sizeLabel)
  if (!sizeRecord || sizeRecord.colors.length === 0) {
    return null
  }
  return sizeRecord.colors.find((c) => c.colorLabel === preferredColor) ?? sizeRecord.colors[0]
}
