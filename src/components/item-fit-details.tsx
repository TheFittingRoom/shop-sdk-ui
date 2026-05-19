import { useMemo } from 'react'
import type { VtoProductData } from '@/lib/product'
import { CheckCircleIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

interface ItemFitDetailsProps {
  loadedProductData: VtoProductData
  selectedSizeLabel: string | null
}

export function ItemFitDetails({ loadedProductData, selectedSizeLabel }: ItemFitDetailsProps) {
  const { t } = useTranslation()
  const css = useCss((_theme) => ({
    container: {
      width: '100%',
    },
    line: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      marginTop: '4px',
      borderTop: '1px solid rgb(33, 32, 31)',
      paddingTop: '4px',
    },
    firstLine: {
      borderTop: 'none',
      marginTop: '0px',
      paddingTop: '0px',
    },
    detailCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  }))
  const fitLineNodeList = useMemo(() => {
    const selectedSizeRecord = loadedProductData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
    if (!selectedSizeRecord) {
      return null
    }
    return selectedSizeRecord.fit.measurement_location_fits.map((mlf, index) => {
      const locationLabel = t(`size-rec.measurementLocation.${mlf.measurement_location}`) || mlf.measurement_location
      const fit = mlf.fit
      const fitLabel = t(`size-rec.fit.${fit}`) || fit
      return (
        <div key={index} css={[css.line, index === 0 && css.firstLine]}>
          <div css={css.detailCell}>{locationLabel}</div>
          <div css={css.detailCell}>
            {fit === 'perfect_fit' ? (
              <>
                <CheckCircleIcon /> {fitLabel}
              </>
            ) : (
              fitLabel
            )}
          </div>
        </div>
      )
    })
  }, [loadedProductData, selectedSizeLabel])

  return <div css={css.container}>{fitLineNodeList}</div>
}
