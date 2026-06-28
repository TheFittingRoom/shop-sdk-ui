import { create } from 'zustand'
import type { Config } from '@/lib/config'
import type { AuthUser, UserProfile } from '@/lib/firebase'
import type { TestHooks } from '@/lib/firebase-mock'
import type { FittingRoomItem } from '@/lib/fitting-room-storage'
import { readFittingRoom, writeFittingRoom } from '@/lib/fitting-room-storage'
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
  // Optional swatch metadata — populated by themes that fetch Shopify
  // Online Store 2.0 native swatch fields (typically via the Storefront
  // GraphQL API). Consumers (e.g. the fitting-room rail card's swatch row)
  // render: image when present → hex circle when present → text label.
  // Themes that don't surface these fields leave them undefined and the
  // swatch row gracefully degrades or hides itself.
  swatchImageUrl?: string | null
  swatchHex?: string | null
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
  // Test-only data hatch. Production callers MUST NOT set this. When present,
  // src/lib/firebase.ts:_init swaps the real Firebase Auth + Firestore for
  // in-memory mocks seeded from this object. See src/lib/firebase-mock.ts.
  testHooks?: TestHooks
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

  // Transient cross-widget signal: the most recent add to the fitting room.
  // `at` is the wall-clock ms of the add — re-adding the same externalId
  // changes `at`, so subscribers can re-fire on every add (not just changes
  // of externalId). Set by addFittingRoomItem in fitting-room-storage.ts;
  // watched by the fitting-room-icon widget to show the confirmation drawer.
  // Not persisted to localStorage.
  lastAddEvent: { externalId: string; at: number } | null
  setLastAddEvent: (externalId: string) => void

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
  //
  // Each mutation reads the latest localStorage state before applying the
  // change, so two tabs adding different products at the same time merge
  // instead of last-write-wins. The in-memory Zustand value is just a
  // cache of "what was in localStorage the last time we touched it".
  // Cross-tab UI freshness (Tab B's open fitting-room sees Tab A's add
  // without a mutation of its own) is handled by the `storage` event
  // listener registered in fitting-room-storage.ts::_init.
  fittingRoom: [],
  addToFittingRoom: (item: FittingRoomItem) =>
    set(() => {
      const brandId = getStaticData().brandId
      const fresh = readFittingRoom(brandId)
      const next = [...fresh.filter((existing) => existing.externalId !== item.externalId), item]
      writeFittingRoom(brandId, next)
      return { fittingRoom: next }
    }),
  removeFromFittingRoom: (externalId: string) =>
    set(() => {
      const brandId = getStaticData().brandId
      const fresh = readFittingRoom(brandId)
      const next = fresh.filter((existing) => existing.externalId !== externalId)
      writeFittingRoom(brandId, next)
      return { fittingRoom: next }
    }),
  updateFittingRoomItem: (externalId: string, patch: Partial<FittingRoomItem>) =>
    set(() => {
      const brandId = getStaticData().brandId
      const fresh = readFittingRoom(brandId)
      const next = fresh.map((existing) => (existing.externalId === externalId ? { ...existing, ...patch } : existing))
      writeFittingRoom(brandId, next)
      return { fittingRoom: next }
    }),
  clearFittingRoom: () =>
    set(() => {
      writeFittingRoom(getStaticData().brandId, [])
      return { fittingRoom: [] }
    }),

  lastAddEvent: null,
  setLastAddEvent: (externalId: string) => set({ lastAddEvent: { externalId, at: Date.now() } }),

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
