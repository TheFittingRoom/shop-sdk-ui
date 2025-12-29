import { create } from 'zustand'
import { Config } from '@/lib/config'
import { AuthUser, UserProfile } from '@/lib/firebase'
import { DeviceView, OverlayName } from '@/lib/view'

export interface StaticData {
  brandId: number
  productExternalId: string
  environment: string
  isMobileDevice: boolean
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
  deviceView: DeviceView
  setDeviceView: (deviceView: DeviceView) => void
  activeOverlay: OverlayName | null
  activeOverlayProps: Record<string, unknown> | null
  openOverlay: (overlayName: OverlayName, props?: Record<string, unknown>) => void
  closeOverlay: () => void
  userIsLoggedIn: boolean
  setAuthUser: (authUser: AuthUser | null) => void
  userProfile: UserProfile | null
  userHasAvatar: boolean | null
  setUserProfile: (userProfile: UserProfile | null) => void
}

export const useMainStore = create<MainStoreState>((set) => ({
  deviceView: DeviceView.DESKTOP,
  setDeviceView: (deviceView: DeviceView) => set({ deviceView }),
  activeOverlay: null,
  activeOverlayProps: null,
  openOverlay: (overlayName: OverlayName, props?: Record<string, unknown>) =>
    set(() => ({
      activeOverlay: overlayName,
      activeOverlayProps: props || null,
    })),
  closeOverlay: () =>
    set(() => ({
      activeOverlay: null,
      activeOverlayProps: null,
    })),
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
}))
