import { ReactNode, useCallback } from 'react'
import { ContentModal } from '@/components/modal'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { getExternalAssetUrl } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { getStaticData, useMainStore } from '@/lib/store'
import { useStyles } from '@/lib/theme'
import { OverlayName, OverlayProps } from '@/lib/view'

export interface GetAppOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
  noAvatar?: boolean
}

export default function GetAppOverlay({ returnToOverlay, noAvatar }: GetAppOverlayProps) {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
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

  const handleSignInClick = useCallback(() => {
    openOverlay(OverlayName.SIGN_IN, { returnToOverlay })
  }, [returnToOverlay])
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
    <ContentModal
      onRequestClose={closeOverlay}
      title={t('try_it_on')}
    >
      <div style={styles.header}>{noAvatar ? t('get-app.create_avatar') : t('landing.get_the_app')}</div>
      <div style={styles.description}>{t('landing.description')}</div>
      {getAppNode}
      <div style={styles.signIn}>
        {t('landing.already_have_account')}{' '}
        <a onClick={handleSignInClick} style={styles.signInLink}>
          {t('landing.sign_in')}
        </a>
      </div>
      <PoweredByFooter/>
    </ContentModal>
  )
}
