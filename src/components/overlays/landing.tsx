import { Modal } from '@/components/modal'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { getAssetUrl, useStyles } from '@/lib/theme'

export default function LandingOverlay() {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const styles = useStyles((_theme) => ({
    title: {
      textTransform: 'uppercase',
      fontSize: '14px',
    },
  }))
  const videoThumbnailUrl = getAssetUrl('intro-video-thumbnail.png')

  const titleNode = <span style={styles.title}>{t('try_it_on')}</span>
  return (
    <Modal isOpen onRequestClose={closeOverlay} variant="medium" title={titleNode}>
      <div>Meet your mini me!</div>
      <div>Loose on your waist but tight on your hips? We’ll show you.</div>
      <div>
        <img src={videoThumbnailUrl} alt="intro video thumbnail" style={{ width: '100%' }} />
      </div>
    </Modal>
  )
}
