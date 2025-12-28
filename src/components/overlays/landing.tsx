import { useCallback } from 'react'
import TfrIconSvg from '@/assets/tfr-icon.svg?react'
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
    contentContainer: {
      width: '390px',
      marginLeft: 'auto',
      marginRight: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      alignItems: 'center',
    },
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
    footer: {
      position: 'absolute',
      bottom: '16px',
      marginLeft: 'auto',
      marginRight: 'auto',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      marginTop: '24px',
      fontSize: '12px',
    },
    footerPoweredBy: {
      fontSize: '12px',
    },
    footerIcon: {
      width: '16px',
      height: '16px',
    },
    footerTfr: {
      fontSize: '12px',
    },
  }))
  const videoThumbnailUrl = getAssetUrl('intro-video-thumbnail.png')

  const handleGetAppClick = useCallback(() => {
    console.log('Get the app clicked')
  }, [])
  const handleSignInClick = useCallback(() => {
    console.log('Sign in clicked')
  }, [])

  return (
    <Modal
      isOpen
      onRequestClose={closeOverlay}
      variant="medium"
      title={<span style={styles.title}>{t('try_it_on')}</span>}
    >
      <div style={styles.contentContainer}>
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
        <div style={styles.footer}>
          <span style={styles.footerPoweredBy}>{t('powered_by')}</span>
          <TfrIconSvg style={styles.footerIcon} />
          <span style={styles.footerTfr}>{t('the_fitting_room')}</span>
        </div>
      </div>
    </Modal>
  )
}
