import { create } from 'zustand'
import { AuthUser, UserProfile } from '@/lib/firebase'
import { OverlayName } from '@/lib/views'

export interface StaticData {
  brandId: number
  productExternalId: string
  environment: string
}

let staticData: StaticData | null = null

export function setStaticData(data: StaticData) {
  staticData = data
}

export function getStaticData(): StaticData {
  if (!staticData) {
    throw new Error('Static state not set. Call setStaticState first.')
  }
  return staticData
}

export interface MainStoreState {
  activeOverlay: OverlayName | null
  openOverlay: (overlayName: OverlayName) => void
  closeOverlay: () => void
  userIsLoggedIn: boolean
  setAuthUser: (authUser: AuthUser | null) => void
  userProfile: UserProfile | null
  userHasAvatar: boolean | null
  setUserProfile: (userProfile: UserProfile | null) => void
}

export const useMainStore = create<MainStoreState>((set) => ({
  activeOverlay: null,
  openOverlay: (overlayName: OverlayName) =>
    set(() => ({
      activeOverlay: overlayName,
    })),
  closeOverlay: () =>
    set(() => ({
      activeOverlay: null,
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
