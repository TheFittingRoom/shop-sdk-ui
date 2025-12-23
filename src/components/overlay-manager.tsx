import { useMainStore } from '@/lib/store'
import { OVERLAYS, OverlayName } from '@/lib/views'

export function OverlayManager() {
  const activeOverlay = useMainStore((state) => state.activeOverlay)
  if (!activeOverlay) {
    return null
  }
  const OverlayComponent = OVERLAYS[activeOverlay as OverlayName]
  if (!OverlayComponent) {
    return null
  }
  return <OverlayComponent />
}
