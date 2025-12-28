import { useTranslation } from '@/lib/locale'
import { useSizeRecommendation } from '@/lib/size-rec'
import { WidgetProps } from '@/lib/view'

export default function SizeRecWidget({}: WidgetProps) {
  const { t } = useTranslation()
  const recommendedSize = useSizeRecommendation()

  if (!recommendedSize) {
    return null
  }

  return <div>{t('size_rec.recommend', { size: recommendedSize })}</div>
}
