import { TextT } from '@/components/text'
import type { VtoProductData } from '@/lib/product'
import { useTranslation } from '@/lib/locale'
import type { CssProp } from '@/lib/theme'

interface ItemFitTextProps {
  loadedProductData: VtoProductData
  textCss?: CssProp
}

export function ItemFitText({ loadedProductData, textCss }: ItemFitTextProps) {
  const { t } = useTranslation()
  return (
    <TextT
      variant="base"
      css={textCss}
      t="size-rec.item_fit"
      vars={{
        fit:
          t(`size-rec.fitClassification.${loadedProductData.fitClassification}`) || loadedProductData.fitClassification,
      }}
    />
  )
}
