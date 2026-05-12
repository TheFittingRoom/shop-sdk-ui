import { VtoProductData, VtoSizeColorData, VtoSizeData } from '@/components/product-sizing-types'
import { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { getLogger } from '@/lib/logger'
import { getSizeLabelFromSize } from '@/lib/util'

const logger = getLogger('overlays/fitting-room/product-data')

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
