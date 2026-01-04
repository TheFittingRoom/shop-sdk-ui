import { useCallback } from 'react'
import { LinkT } from '@/components/link'
import { getSizeLabelFromSize } from '@/lib/api'
import { useSizeRecommendation } from '@/lib/size-rec'
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
  const sizeLabel = getSizeLabelFromSize(sizeRecommendation.recommended_size)
  if (!sizeLabel) {
    return null
  }

  return <LinkT onClick={handleLinkClick} variant="brand" t="widget.size_rec.recommend" vars={{ size: sizeLabel }} />
}
