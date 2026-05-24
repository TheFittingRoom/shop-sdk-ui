import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { getSizeLabelFromSize } from '@/lib/util'

export interface FittingRoomItem {
  externalId: string
  handle: string | null
  size: string | null
  color: string | null
  colorwaySizeAssetId: number | null
  addedAt: number
}

export const STORAGE_KEY = 'tfr:fitting-room:v1'

const logger = getLogger('fitting-room-storage')

type StoredShape = Record<string, FittingRoomItem[]>

function readAll(): StoredShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as StoredShape
  } catch (error) {
    logger.logWarn('Failed to read fitting room from localStorage', { error })
    return {}
  }
}

function writeAll(all: StoredShape): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (error) {
    logger.logWarn('Failed to write fitting room to localStorage', { error })
  }
}

export function readFittingRoom(brandId: number): FittingRoomItem[] {
  const all = readAll()
  const items = all[String(brandId)]
  return Array.isArray(items) ? items : []
}

export function writeFittingRoom(brandId: number, items: FittingRoomItem[]): void {
  const all = readAll()
  all[String(brandId)] = items
  writeAll(all)
}

export function _init(): void {
  const { brandId } = getStaticData()
  const items = readFittingRoom(brandId)
  useMainStore.setState({ fittingRoom: items })

  // Cross-tab freshness: localStorage fires `storage` on *other* tabs
  // (not the writing tab) whenever a key changes. When another tab
  // mutates the fitting room, re-read from localStorage so this tab's
  // in-memory model — and any UI subscribing to it — stays in sync.
  // The writing tab doesn't get this event, which is correct (would
  // otherwise loop). `e.newValue === null` covers the case where the
  // key was cleared entirely; readFittingRoom handles that.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) {
        return
      }
      useMainStore.setState({ fittingRoom: readFittingRoom(brandId) })
    })
  }
}

// Resolve a colorway_size_asset id from a (size, color) selection for
// currentProduct. Returns null when productData hasn't loaded yet, when the
// size doesn't match any known recommendation, or when the color doesn't
// match any variant's SKU. Callers store the null and downstream resolve
// paths (e.g. ensureSizeForItem in the fitting-room overlay) re-derive when
// productData becomes available.
function resolveCurrentProductCsaId(productId: string, size: string | null, color: string | null): number | null {
  if (size == null) {
    return null
  }
  const { currentProduct } = getStaticData()
  if (!currentProduct) {
    return null
  }
  const stored = useMainStore.getState().productData[productId]
  if (!stored || 'error' in stored) {
    return null
  }
  const sizeRec = stored.sizeFitRecommendation.available_sizes.find((s) => getSizeLabelFromSize(s) === size)
  if (!sizeRec) {
    return null
  }
  const csa = sizeRec.colorway_size_assets.find((c) => {
    const variant = currentProduct.variants.find((v) => v.sku === c.sku)
    return variant?.color === color
  })
  return csa?.id ?? null
}

// The add path shared by toggleFittingRoomItem and ensureFittingRoomItem.
//
// We deliberately do NOT capture the PDP's currently-selected size. Size
// belongs to the TFR size-recommendation flow: the fitting-room overlay's
// ensureSizeForItem auto-picks the recommended size for the stored color
// the first time the shopper selects the item, and the overlay's own size
// selector is the only place size is ever persisted. Storing the PDP size
// here would override that — typically with something the shopper picked
// before the size recommendation existed.
async function addFittingRoomItem(productId: string, handle: string | null, isPdp: boolean): Promise<void> {
  const state = useMainStore.getState()
  logger.logDebug('{{ts}} - Adding to fitting room', { productId, handle, isPdp })

  let color: string | null = null
  let resolvedHandle: string | null = handle

  if (isPdp) {
    const { currentProduct } = getStaticData()
    if (currentProduct) {
      if (!resolvedHandle) {
        resolvedHandle = currentProduct.handle
      }
      try {
        const selection = await currentProduct.getSelectedOptions()
        color = selection.color
      } catch (error) {
        logger.logWarn('Failed to read selected options from currentProduct', { error })
      }
    }
  }

  state.addToFittingRoom({
    externalId: productId,
    handle: resolvedHandle,
    size: null,
    color,
    colorwaySizeAssetId: null,
    addedAt: Date.now(),
  })
}

// Re-read currentProduct's selected color and, if the product is already in
// the fitting-room storage, write the new color (and re-resolved CSA) to
// its entry. Intended use: the host theme calls this whenever the PDP's
// variant selector changes, so the shopper's latest color pick is reflected
// the next time they open any TFR overlay.
//
// PDP size is deliberately ignored — size belongs to the TFR size-rec flow,
// not the PDP. Any size the shopper picked inside a TFR overlay is
// preserved; we recompute CSA from (existing size, new color) so the stored
// CSA stays consistent with the new color choice.
//
// No-op when there's no currentProduct (e.g. we're on a collection page),
// when the product isn't in the fitting room, or when the new color matches
// what's already stored. Safe to call as often as needed.
export async function syncCurrentProductSelection(): Promise<void> {
  const { currentProduct } = getStaticData()
  if (!currentProduct) {
    return
  }
  const state = useMainStore.getState()
  const existing = state.fittingRoom.find((item) => item.externalId === currentProduct.externalId)
  if (!existing) {
    return
  }

  let color: string | null = null
  try {
    const selection = await currentProduct.getSelectedOptions()
    color = selection.color
  } catch (error) {
    logger.logWarn('syncCurrentProductSelection: failed to read selected options', { error })
    return
  }

  if (color === existing.color) {
    return
  }

  const colorwaySizeAssetId = resolveCurrentProductCsaId(currentProduct.externalId, existing.size, color)
  state.updateFittingRoomItem(currentProduct.externalId, { color, colorwaySizeAssetId })
  logger.logDebug('{{ts}} - Synced PDP color into fitting-room', {
    externalId: currentProduct.externalId,
    color,
    colorwaySizeAssetId,
  })
}

export async function toggleFittingRoomItem(productId: string, handle: string | null, isPdp: boolean): Promise<void> {
  const state = useMainStore.getState()
  const isInFittingRoom = state.fittingRoom.some((item) => item.externalId === productId)
  if (isInFittingRoom) {
    logger.logDebug('{{ts}} - Removing from fitting room', { productId })
    state.removeFromFittingRoom(productId)
    return
  }
  await addFittingRoomItem(productId, handle, isPdp)
}

// Add the product to the fitting room if it isn't already there — never
// removes. Used when opening the fitting-room overlay from the PDP "Try It
// On" CTA, where the current product must be present so it can be preselected.
export async function ensureFittingRoomItem(productId: string, handle: string | null, isPdp: boolean): Promise<void> {
  const state = useMainStore.getState()
  if (state.fittingRoom.some((item) => item.externalId === productId)) {
    return
  }
  await addFittingRoomItem(productId, handle, isPdp)
}
