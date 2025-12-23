import { useMainStore } from '@/lib/store'
import { OverlayName, WidgetProps } from '@/lib/views'

export default function VtoButtonWidget({}: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)

  const openVto = () => {
    openOverlay(OverlayName.VTO_SINGLE)
  }

  return <button onClick={openVto}>Virtual Try-On</button>
}
