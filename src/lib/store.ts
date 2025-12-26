import { create } from 'zustand'
import { UserProfile } from '@/lib/firebase'
import { OverlayName } from '@/lib/views'

export interface MainStoreState {
  activeOverlay: OverlayName | null
  openOverlay: (overlayName: OverlayName) => void
  closeOverlay: () => void
  userIsLoggedIn: boolean
  setUserIsLoggedIn: (isLoggedIn: boolean) => void
  userProfile: UserProfile | null
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
  setUserIsLoggedIn: (isLoggedIn: boolean) => set({ userIsLoggedIn: isLoggedIn }),
  userProfile: null,
  setUserProfile: (userProfile: UserProfile | null) => set({ userProfile }),
}))
