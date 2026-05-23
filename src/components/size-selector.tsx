import { useMemo } from 'react'
import { Button } from '@/components/button'
import type { VtoProductData } from '@/lib/product'
import { useCss } from '@/lib/theme'

interface SizeSelectorProps {
  loadedProductData: VtoProductData
  selectedSizeLabel: string | null
  onChangeSize: (newSizeLabel: string) => void
}

export function SizeSelector({ loadedProductData, selectedSizeLabel, onChangeSize }: SizeSelectorProps) {
  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    button: {
      width: '54px',
      height: '44px',
      border: '1px solid rgba(33, 32, 31, 0.2)',
      padding: '9px 5px',
    },
    selectedButton: {
      border: '1px solid rgb(33, 32, 31)',
      cursor: 'default',
    },
  }))
  const sizeSelectorNodeList = useMemo(
    () =>
      loadedProductData.sizes.map((sizeRecord) => {
        const isSelected = sizeRecord.sizeLabel === selectedSizeLabel
        return (
          <Button
            key={sizeRecord.sizeLabel}
            variant="base"
            css={{ ...css.button, ...(isSelected && css.selectedButton) }}
            onClick={() => {
              if (isSelected) {
                return
              }
              onChangeSize(sizeRecord.sizeLabel)
            }}
          >
            {sizeRecord.sizeLabel}
          </Button>
        )
      }),
    [loadedProductData.sizes, selectedSizeLabel, onChangeSize, css.button, css.selectedButton],
  )
  return <div css={css.container}>{sizeSelectorNodeList}</div>
}
