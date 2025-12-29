import { useCallback } from 'react'
import { ContentModal } from '@/components/modal'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { getExternalAssetUrl } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useStyles } from '@/lib/theme'
import { OverlayName } from '@/lib/view'

export default function LandingOverlay() {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const styles = useStyles((_theme) => ({
    header: {
      fontFamily: 'Times New Roman, serif',
      fontSize: '32px',
    },
    description: {
      fontSize: '14px',
    },
    videoContainer: {
      marginTop: '16px',
    },
    videoThumbnailImage: {
      width: '100%',
    },
    buttonContainer: {
      marginTop: '16px',
      width: '100%',
    },
    primaryButton: {
      display: 'block',
      width: '100%',
      backgroundColor: '#265A64',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '25px',
      padding: '16px 24px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
    },
    signIn: {
      marginTop: '16px',
      fontSize: '16px',
    },
    signInLink: {
      color: '#265A64',
      cursor: 'pointer',
      fontSize: '16px',
    },
  }))
  const videoThumbnailUrl = getExternalAssetUrl('intro-video-thumbnail.png')

  const handleGetAppClick = useCallback(() => {
    openOverlay(OverlayName.GET_APP)
  }, [])
  const handleSignInClick = useCallback(() => {
    openOverlay(OverlayName.SIGN_IN)
  }, [])

  return (
    <ContentModal
      onRequestClose={closeOverlay}
      title={t('try_it_on')}
    >
      <div style={styles.header}>{t('landing.header')}</div>
      <div style={styles.description}>{t('landing.description')}</div>
      <div style={styles.videoContainer}>
        <img src={videoThumbnailUrl} alt="intro video thumbnail" style={styles.videoThumbnailImage} />
      </div>
      <div style={styles.buttonContainer}>
        <button onClick={handleGetAppClick} style={styles.primaryButton}>
          {t('landing.get_the_app')}
        </button>
      </div>
      <div style={styles.signIn}>
        {t('landing.already_have_account')}{' '}
        <a onClick={handleSignInClick} style={styles.signInLink}>
          {t('landing.sign_in')}
        </a>
      </div>
      <PoweredByFooter />
    </ContentModal>
  )
}
