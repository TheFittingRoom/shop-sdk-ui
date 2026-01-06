import { ReactNode, useCallback } from 'react'
import { Button } from '@/components/button'
import { LinkT } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { TextT } from '@/components/text'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { getExternalAssetUrl } from '@/lib/asset'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName, OverlayProps } from '@/lib/view'

export interface GetAppOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
  noAvatar?: boolean
}

export default function GetAppOverlay({ returnToOverlay, noAvatar }: GetAppOverlayProps) {
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const isMobileDevice = useMainStore((state) => state.isMobileDevice)
  const css = useCss((theme) => ({
    titleText: {
      textTransform: 'uppercase',
    },
    headerText: {
      fontSize: '32px',
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
    getAppMobileImage: {
      width: '150px',
    },
    signInContainer: {
      marginTop: '32px',
    },
    signInText: {
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
  if (isMobileDevice) {
    getAppNode = (
      <div css={css.getAppMobileContainer}>
        <Button variant="base" onClick={handleGetAppAppleClick}>
          <img src={getExternalAssetUrl('get-app-apple-store.png')} alt="Apple Store" css={css.getAppMobileImage} />
        </Button>
        <Button variant="base" onClick={handleGetAppGoogleClick}>
          <img src={getExternalAssetUrl('get-app-google-play.png')} alt="Google Play" css={css.getAppMobileImage} />
        </Button>
      </div>
    )
  } else {
    getAppNode = (
      <div css={css.getAppQrContainer}>
        <img src={getExternalAssetUrl('get-app-qr-code.png')} alt="QR Code" css={css.getAppQrImage} />
      </div>
    )
  }
  return (
    <ContentModal onRequestClose={closeOverlay} title={<TextT variant="brand" css={css.titleText} t="try_it_on" />}>
      <div>
        <TextT variant="brand" css={css.headerText} t={noAvatar ? 'get-app.create_avatar' : 'landing.get_the_app'} />
      </div>
      <div>
        <TextT variant="base" t="landing.description" />
      </div>
      {getAppNode}
      <div css={css.signInContainer}>
        <TextT variant="base" css={css.signInText} t="landing.already_have_account" />
        &nbsp;
        <LinkT onClick={handleSignInClick} variant="base" css={css.signInLink} t="landing.sign_in" />
      </div>
      <PoweredByFooter />
    </ContentModal>
  )
}
