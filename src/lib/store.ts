import { create } from 'zustand'
import { OverlayName } from './views'

export interface MainStoreState {
  activeOverlay: OverlayName | null
  openOverlay: (overlayName: OverlayName) => void
  closeOverlay: () => void
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
}))
