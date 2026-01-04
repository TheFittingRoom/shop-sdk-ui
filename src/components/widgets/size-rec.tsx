import { useCallback, useEffect } from 'react'
import { LinkT } from '@/components/link'
import { getSizeLabelFromSize } from '@/lib/api'
import { getLogger } from '@/lib/logger'
import { useSizeRecommendation } from '@/lib/size-rec'
import { useMainStore } from '@/lib/store'
import { OverlayName, WidgetProps } from '@/lib/view'

const logger = getLogger('size-rec')

export default function SizeRecWidget({}: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)
  const openedOverlays = useMainStore((state) => state.openedOverlays)
  const hasOpenedVtoSingleOverlay = openedOverlays.includes(OverlayName.VTO_SINGLE)

  // Load size recommendation, after VTO single overlay has been opened
  const { record: sizeRecommendationRecord, error: sizeRecommendationError } = useSizeRecommendation(hasOpenedVtoSingleOverlay)
  useEffect(() => {
    if (sizeRecommendationError) {
      logger.logError('Error loading size recommendation:', sizeRecommendationError)
    }
  }, [sizeRecommendationError])

  const handleLinkClick = useCallback(() => {
    openOverlay(OverlayName.VTO_SINGLE)
  }, [])

  // RENDERING:

  if (!sizeRecommendationRecord || !hasOpenedVtoSingleOverlay) {
    return null
  }
  const sizeLabel = getSizeLabelFromSize(sizeRecommendationRecord.recommended_size)
  if (!sizeLabel) {
    return null
  }

  return <LinkT onClick={handleLinkClick} variant="brand" t="widget.size_rec.recommend" vars={{ size: sizeLabel }} />
}
