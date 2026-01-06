import { useMainStore } from '@/lib/store'
import { OVERLAYS, OverlayName } from '@/lib/view'

export function OverlayManager() {
  const activeOverlay = useMainStore((state) => state.activeOverlay)
  const activeOverlayProps = useMainStore((state) => state.activeOverlayProps)
  if (!activeOverlay) {
    return null
  }
  const OverlayComponent = OVERLAYS[activeOverlay as OverlayName]
  if (!OverlayComponent) {
    return null
  }
  return <OverlayComponent {...activeOverlayProps} />
}
