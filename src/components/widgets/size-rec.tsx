import { useTranslation } from '@/lib/locale'
import { WidgetProps } from '@/lib/views'
// import { useMainStore } from '@/lib/store'

export default function SizeRecWidget({}: WidgetProps) {
  const { t } = useTranslation()
  return <div>{t('size_rec.recommend', { size: 'M' })}</div>
}
