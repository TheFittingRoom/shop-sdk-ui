import { create } from 'zustand'
import type { Config } from '@/lib/config'
import type { AuthUser, UserProfile } from '@/lib/firebase'
import type { FittingRoomItem } from '@/lib/fitting-room-storage'
import { writeFittingRoom } from '@/lib/fitting-room-storage'
import type { LoadedProductData, LoadedProductError } from '@/lib/product'
import type { OverlayName } from '@/lib/view'
import { DeviceLayout } from '@/lib/view'

export interface ExternalProductVariant {
  sku: string
  size: string
  color: string
  fullName: string
  skuName: string
  priceFormatted: string
  imageUrl: string | null
}

export interface ExternalProductOptionSelection {
  size: string
  color: string | null
}

export interface ExternalProduct {
  productName: string
  productDescriptionHtml: string
  externalId: string
  handle: string | null
  imageUrl: string | null
  variants: ExternalProductVariant[]
  getSelectedOptions: () => ExternalProductOptionSelection | Promise<ExternalProductOptionSelection>
  addToCart: (options: ExternalProductOptionSelection) => void | Promise<void>
}

export type MerchantProductError = { error: Error }

export type ProductLookup = (handles: string[]) => Promise<ExternalProduct[]>
export type GetOverlayTopOffset = () => number
export type AddToCart = (externalId: string, options: ExternalProductOptionSelection) => void | Promise<void>

export interface StaticData {
  brandId: number
  currentProduct: ExternalProduct | null
  environment: string
  config: Config
  productLookup: ProductLookup | null
  getOverlayTopOffset: GetOverlayTopOffset | null
  addToCart: AddToCart | null
}

let staticData: StaticData | null = null

export function _init(initStaticData: StaticData) {
  staticData = initStaticData
}

export function getStaticData(): StaticData {
  if (!staticData) {
    throw new Error('Static state not set. Call _init first.')
  }
  return staticData
}

export interface MainStoreState {
  // Device info:
  isMobileDevice: boolean
  deviceLayout: DeviceLayout
  setDevice: (params: { isMobileDevice: boolean; deviceLayout: DeviceLayout }) => void

  // User data:
  userIsLoggedIn: boolean
  setAuthUser: (authUser: AuthUser | null) => void
  userProfile: UserProfile | null
  userHasAvatar: boolean | null
  setUserProfile: (userProfile: UserProfile | null) => void

  // Product data:
  productData: Record<string, LoadedProductData | LoadedProductError>
  setProductData: (externalId: string, data: LoadedProductData | LoadedProductError) => void

  // Merchant-supplied product data (Shopify, etc.) keyed by externalId:
  merchantProductData: Record<string, ExternalProduct | MerchantProductError>
  setMerchantProductData: (externalId: string, data: ExternalProduct | MerchantProductError) => void

  // Fitting room:
  fittingRoom: FittingRoomItem[]
  addToFittingRoom: (item: FittingRoomItem) => void
  removeFromFittingRoom: (externalId: string) => void
  updateFittingRoomItem: (externalId: string, patch: Partial<FittingRoomItem>) => void
  clearFittingRoom: () => void

  // UI state:
  activeOverlay: OverlayName | null
  activeOverlayProps: Record<string, unknown> | null
  openOverlay: (overlayName: OverlayName, props?: Record<string, unknown>) => void
  closeOverlay: () => void
  openedOverlays: OverlayName[]
}

export const useMainStore = create<MainStoreState>((set) => ({
  // Device info:
  isMobileDevice: false,
  deviceLayout: DeviceLayout.DESKTOP,
  setDevice: ({ isMobileDevice, deviceLayout }: { isMobileDevice: boolean; deviceLayout: DeviceLayout }) =>
    set({ isMobileDevice, deviceLayout }),

  // User data:
  userIsLoggedIn: false,
  setAuthUser: (authUser: AuthUser | null) => {
    const isLoggedIn = !!authUser
    set({ userIsLoggedIn: isLoggedIn })
  },
  userProfile: null,
  userHasAvatar: null,
  setUserProfile: (userProfile: UserProfile | null) => {
    const userHasAvatar = userProfile ? userProfile.avatar_status === 'CREATED' : null
    set({ userProfile, userHasAvatar })
  },

  // Product data:
  productData: {},
  setProductData: (externalId: string, data: LoadedProductData | LoadedProductError) =>
    set((prevState) => ({
      productData: {
        ...prevState.productData,
        [externalId]: data,
      },
    })),

  // Merchant-supplied product data:
  merchantProductData: {},
  setMerchantProductData: (externalId: string, data: ExternalProduct | MerchantProductError) =>
    set((prevState) => ({
      merchantProductData: {
        ...prevState.merchantProductData,
        [externalId]: data,
      },
    })),

  // Fitting room:
  fittingRoom: [],
  addToFittingRoom: (item: FittingRoomItem) =>
    set((prevState) => {
      const filtered = prevState.fittingRoom.filter((existing) => existing.externalId !== item.externalId)
      const next = [...filtered, item]
      writeFittingRoom(getStaticData().brandId, next)
      return { fittingRoom: next }
    }),
  removeFromFittingRoom: (externalId: string) =>
    set((prevState) => {
      const next = prevState.fittingRoom.filter((existing) => existing.externalId !== externalId)
      writeFittingRoom(getStaticData().brandId, next)
      return { fittingRoom: next }
    }),
  updateFittingRoomItem: (externalId: string, patch: Partial<FittingRoomItem>) =>
    set((prevState) => {
      const next = prevState.fittingRoom.map((existing) =>
        existing.externalId === externalId ? { ...existing, ...patch } : existing,
      )
      writeFittingRoom(getStaticData().brandId, next)
      return { fittingRoom: next }
    }),
  clearFittingRoom: () =>
    set(() => {
      writeFittingRoom(getStaticData().brandId, [])
      return { fittingRoom: [] }
    }),

  // UI state:
  activeOverlay: null,
  activeOverlayProps: null,
  openOverlay: (overlayName: OverlayName, props?: Record<string, unknown>) =>
    set((prevState) => {
      const updateState: Partial<MainStoreState> = {
        activeOverlay: overlayName,
        activeOverlayProps: props || null,
      }
      if (!prevState.openedOverlays.includes(overlayName)) {
        updateState.openedOverlays = [...prevState.openedOverlays, overlayName]
      }
      return updateState
    }),
  closeOverlay: () =>
    set({
      activeOverlay: null,
      activeOverlayProps: null,
    }),
  openedOverlays: [],
}))
