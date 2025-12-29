import { ContentModal } from '@/components/modal'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'

export default function SignInOverlay() {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  return (
    <ContentModal
      onRequestClose={closeOverlay}
      title={t('try_it_on')}
    >
      <div>sign-in modal</div>
    </ContentModal>
  )
}
