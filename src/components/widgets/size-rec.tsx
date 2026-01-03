import { useCallback } from 'react'
import { LinkT } from '@/components/link'
import { useSizeRecommendation } from '@/lib/api-hooks'
import { useMainStore } from '@/lib/store'
import { OverlayName, WidgetProps } from '@/lib/view'

export default function SizeRecWidget({}: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)
  const openedOverlays = useMainStore((state) => state.openedOverlays)
  const hasOpenedVtoSingleOverlay = openedOverlays.includes(OverlayName.VTO_SINGLE)
  const sizeRecommendation = useSizeRecommendation(hasOpenedVtoSingleOverlay)
  const handleLinkClick = useCallback(() => {
    openOverlay(OverlayName.VTO_SINGLE)
  }, [])

  if (!sizeRecommendation || !hasOpenedVtoSingleOverlay) {
    return null
  }

  return (
    <LinkT
      onClick={handleLinkClick}
      variant="brand"
      t="widget.size_rec.recommend"
      vars={{ size: sizeRecommendation.recommended_size.label }}
    />
  )
}
