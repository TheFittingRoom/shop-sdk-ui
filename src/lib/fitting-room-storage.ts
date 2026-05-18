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
}

export async function toggleFittingRoomItem(
  productId: string,
  handle: string | null,
  isPdp: boolean,
): Promise<void> {
  const state = useMainStore.getState()
  const isInFittingRoom = state.fittingRoom.some((item) => item.externalId === productId)
  if (isInFittingRoom) {
    logger.logDebug('{{ts}} - Removing from fitting room', { productId })
    state.removeFromFittingRoom(productId)
    return
  }
  logger.logDebug('{{ts}} - Adding to fitting room', { productId, handle, isPdp })

  let size: string | null = null
  let color: string | null = null
  let colorwaySizeAssetId: number | null = null
  let resolvedHandle: string | null = handle

  if (isPdp) {
    const { currentProduct } = getStaticData()
    if (currentProduct) {
      if (!resolvedHandle) {
        resolvedHandle = currentProduct.handle
      }
      try {
        const selection = await currentProduct.getSelectedOptions()
        size = selection.size || null
        color = selection.color
      } catch (error) {
        logger.logWarn('Failed to read selected options from currentProduct', { error })
      }

      const stored = state.productData[productId]
      if (stored && !('error' in stored) && size != null) {
        const sizeRec = stored.sizeFitRecommendation.available_sizes.find(
          (s) => getSizeLabelFromSize(s) === size,
        )
        if (sizeRec) {
          const csa = sizeRec.colorway_size_assets.find((c) => {
            const variant = currentProduct.variants.find((v) => v.sku === c.sku)
            return variant?.color === color
          })
          if (csa) {
            colorwaySizeAssetId = csa.id
          }
        }
      }
    }
  }

  state.addToFittingRoom({
    externalId: productId,
    handle: resolvedHandle,
    size,
    color,
    colorwaySizeAssetId,
    addedAt: Date.now(),
  })
}
