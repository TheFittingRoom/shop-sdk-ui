import { ReactNode, useCallback } from 'react'
import { Link } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { getExternalAssetUrl } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
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
  const css = useCss((theme) => ({
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
      color: theme.color_tfr_800,
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
        <div css={css.getAppMobileContainer}>
          <button css={css.getAppMobileButton} onClick={handleGetAppAppleClick}>
            <img src={appleStoreImageUrl} alt="Apple Store" css={css.getAppMobileImage} />
          </button>
          <button css={css.getAppMobileButton} onClick={handleGetAppGoogleClick}>
            <img src={googlePlayImageUrl} alt="Google Play" css={css.getAppMobileImage} />
          </button>
        </div>
      )
      break
    }
    default: {
      const qrCodeImageUrl = getExternalAssetUrl('get-app-qr-code.png')
      getAppNode = (
        <div css={css.getAppQrContainer}>
          <img src={qrCodeImageUrl} alt="QR Code" css={css.getAppQrImage} />
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
      <div css={css.header}>{noAvatar ? t('get-app.create_avatar') : t('landing.get_the_app')}</div>
      <div css={css.description}>{t('landing.description')}</div>
      {getAppNode}
      <div css={css.signIn}>
        {t('landing.already_have_account')}{' '}
        <Link onClick={handleSignInClick} variant="base" css={css.signInLink}>
          {t('landing.sign_in')}
        </Link>
      </div>
      <PoweredByFooter/>
    </ContentModal>
  )
}
