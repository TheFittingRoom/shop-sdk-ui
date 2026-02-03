import { create } from 'zustand'
import { Config } from '@/lib/config'
import { AuthUser, UserProfile } from '@/lib/firebase'
import { LoadedProductData, LoadedProductError } from '@/lib/product'
import { DeviceLayout, OverlayName } from '@/lib/view'

export interface ExternalProductVariant {
  sku: string
  size: string
  color: string
  fullName: string
  skuName: string
  priceFormatted: string
}

export interface ExternalProductOptionSelection {
  size: string
  color: string | null
}

export interface ExternalProduct {
  productName: string
  productDescriptionHtml: string
  externalId: string
  variants: ExternalProductVariant[]
  getSelectedOptions: () => ExternalProductOptionSelection | Promise<ExternalProductOptionSelection>
  addToCart: (options: ExternalProductOptionSelection) => void | Promise<void>
}

export interface StaticData {
  brandId: number
  currentProduct: ExternalProduct
  environment: string
  config: Config
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
