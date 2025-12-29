import { ReactNode, useCallback, useState } from 'react'
import { Modal } from '@/components/modal'
import { getExternalAssetUrl, TfrIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { getStaticData, useMainStore } from '@/lib/store'
import { useStyles } from '@/lib/theme'

export default function LandingOverlay() {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const [view, setView] = useState<'intro' | 'get-app'>('intro')
  const styles = useStyles((_theme) => ({
    title: {
      textTransform: 'uppercase',
      fontSize: '14px',
    },
    contentContainer: {
      maxWidth: '390px',
      marginLeft: 'auto',
      marginRight: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      alignItems: 'center',
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
      width: '20px',
      height: '20px',
    },
    footerTfr: {
      fontSize: '12px',
    },
  }))

  const handleGetAppClick = useCallback(() => {
    setView('get-app')
  }, [])
  const handleSignInClick = useCallback(() => {
    console.log('Sign in clicked')
  }, [])

  let contentNode: ReactNode
  switch (view) {
    case 'get-app':
      contentNode = <GetAppView onSignInClick={handleSignInClick} />
      break
    case 'intro':
    default:
      contentNode = <IntroView onGetAppClick={handleGetAppClick} onSignInClick={handleSignInClick} />
  }
  return (
    <Modal
      isOpen
      onRequestClose={closeOverlay}
      variant="medium"
      title={<span style={styles.title}>{t('try_it_on')}</span>}
    >
      <div style={styles.contentContainer}>
        {contentNode}
        <div style={styles.footer}>
          <span style={styles.footerPoweredBy}>{t('powered_by')}</span>
          <TfrIcon style={styles.footerIcon} />
          <span style={styles.footerTfr}>{t('the_fitting_room')}</span>
        </div>
      </div>
    </Modal>
  )
}

interface IntroProps {
  onGetAppClick?: () => void
  onSignInClick?: () => void
}

function IntroView({ onGetAppClick, onSignInClick }: IntroProps) {
  const { t } = useTranslation()
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
  return (
    <>
      <div style={styles.header}>{t('landing.header')}</div>
      <div style={styles.description}>{t('landing.description')}</div>
      <div style={styles.videoContainer}>
        <img src={videoThumbnailUrl} alt="intro video thumbnail" style={styles.videoThumbnailImage} />
      </div>
      <div style={styles.buttonContainer}>
        <button onClick={onGetAppClick} style={styles.primaryButton}>
          {t('landing.get_the_app')}
        </button>
      </div>
      <div style={styles.signIn}>
        {t('landing.already_have_account')}{' '}
        <a onClick={onSignInClick} style={styles.signInLink}>
          {t('landing.sign_in')}
        </a>
      </div>
    </>
  )
}

interface GetAppProps {
  onSignInClick?: () => void
}

function GetAppView({ onSignInClick }: GetAppProps) {
  const { t } = useTranslation()
  const deviceView = useMainStore((state) => state.deviceView)
  const styles = useStyles((_theme) => ({
    header: {
      fontFamily: 'Times New Roman, serif',
      fontSize: '32px',
    },
    description: {
      fontSize: '14px',
    },
    getAppQrContainer: {
      marginTop: '16px',
    },
    getAppQrImage: {
      width: '100%',
    },
    getAppMobileContainer: {
      marginTop: '16px',
      display: 'flex',
      justifyContent: 'space-around',
      gap: '16px',
    },
    getAppMobileButton: {
      backgroundColor: 'none',
      border: 'none',
      cursor: 'pointer',
    },
    getAppMobileImage: {
      width: '150px',
    },
    signIn: {
      marginTop: '32px',
      fontSize: '16px',
    },
    signInLink: {
      color: '#265A64',
      cursor: 'pointer',
      fontSize: '16px',
    },
  }))
  const handleGetAppAppleClick = useCallback(() => {
    const url = getStaticData().config.links.appAppleStoreUrl
    window.open(url, '_blank')
  }, [])
  const handleGetAppGoogleClick = useCallback(() => {
    const url = getStaticData().config.links.appGooglePlayUrl
    window.open(url, '_blank')
  }, [])
  let getAppNode: ReactNode
  switch (deviceView) {
    case 'mobile': {
      const appleStoreImageUrl = getExternalAssetUrl('get-app-apple-store.png')
      const googlePlayImageUrl = getExternalAssetUrl('get-app-google-play.png')
      getAppNode = (
        <div style={styles.getAppMobileContainer}>
          <button style={styles.getAppMobileButton} onClick={handleGetAppAppleClick}>
            <img src={appleStoreImageUrl} alt="Apple Store" style={styles.getAppMobileImage} />
          </button>
          <button style={styles.getAppMobileButton} onClick={handleGetAppGoogleClick}>
            <img src={googlePlayImageUrl} alt="Google Play" style={styles.getAppMobileImage} />
          </button>
        </div>
      )
      break
    }
    default: {
      const qrCodeImageUrl = getExternalAssetUrl('get-app-qr-code.png')
      getAppNode = (
        <div style={styles.getAppQrContainer}>
          <img src={qrCodeImageUrl} alt="QR Code" style={styles.getAppQrImage} />
        </div>
      )
      break
    }
  }
  return (
    <>
      <div style={styles.header}>{t('landing.get_the_app')}</div>
      <div style={styles.description}>{t('landing.description')}</div>
      {getAppNode}
      <div style={styles.signIn}>
        {t('landing.already_have_account')}{' '}
        <a onClick={onSignInClick} style={styles.signInLink}>
          {t('landing.sign_in')}
        </a>
      </div>
    </>
  )
}
