import { TextT } from '@/components/text'
import { useSizeRecommendation } from '@/lib/api-hooks'
import { useCss } from '@/lib/theme'
import { WidgetProps } from '@/lib/view'

export default function SizeRecWidget({}: WidgetProps) {
  const recommendedSize = useSizeRecommendation()
  const css = useCss((_theme) => ({
    text: {
      textDecoration: 'underline',
    },
  }))

  if (!recommendedSize) {
    return null
  }

  return <TextT variant="brand" css={css.text} t="size_rec.recommend" vars={{ size: recommendedSize }} />
}
