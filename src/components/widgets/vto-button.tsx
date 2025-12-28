import TfrDoorSvg from '@/assets/tfr-door-brand.svg?react'
import { useMainStore } from '@/lib/store'
import { OverlayName, WidgetProps } from '@/lib/views'

export default function VtoButtonWidget({}: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)

  const openVto = () => {
    openOverlay(OverlayName.VTO_SINGLE)
  }

  return (
    <button
      type="button"
      onClick={openVto}
      style={{
        padding: '10px 20px',
        backgroundColor: '#0070f3',
        color: '#fff',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
      }}
    >
      <TfrDoorSvg width={30} height={30} />
      Virtual Try-On
    </button>
  )
}
