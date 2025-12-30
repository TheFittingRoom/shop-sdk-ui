import { useTranslation } from '@/lib/locale'
import { useSizeRecommendation } from '@/lib/api-hooks'
import { useCss } from '@/lib/theme'
import { WidgetProps } from '@/lib/view'

export default function SizeRecWidget({}: WidgetProps) {
  const { t } = useTranslation()
  const recommendedSize = useSizeRecommendation()
  const css = useCss((_theme) => ({
    container: {
      textDecoration: 'underline',
    },
  }))

  if (!recommendedSize) {
    return null
  }

  return <div css={css.container}>{t('size_rec.recommend', { size: recommendedSize })}</div>
}
