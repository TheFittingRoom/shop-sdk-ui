import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { Button } from '@/components/button'
import { LinkT } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { TextT } from '@/components/text'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { GET_APP_QR_CODE_URL, getExternalAssetUrl } from '@/lib/asset'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { OverlayProps } from '@/lib/view'
import { OverlayName } from '@/lib/view'

export interface GetAppOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

// GetAppOverlay is the signed-out "Create your Mini Me" screen, reached from
// the landing and sign-in screens: how to get the app, and a way back to
// signing in.
export default function GetAppOverlay({ returnToOverlay }: GetAppOverlayProps) {
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const css = useCss((theme) => ({
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
  }, [openOverlay, returnToOverlay])

  return (
    <GetAppModal onRequestClose={closeOverlay}>
      <div css={css.signInContainer}>
        <TextT variant="base" css={css.signInText} t="landing.already_have_account" />
        &nbsp;
        <LinkT onClick={handleSignInClick} variant="base" css={css.signInLink} t="landing.sign_in" />
      </div>
    </GetAppModal>
  )
}

// GetAppPopup shows the same content over whatever overlay is open, for a
// signed-in shopper still using the demo avatar ("Create your Mini Me"
// pills). It is a modal of its own rather than a switch to GET_APP, so
// closing it returns them to the overlay exactly as they left it.
export function GetAppPopup({ onClose }: { onClose: () => void }) {
  return <GetAppModal onRequestClose={onClose} />
}

// GetAppModal: what the Mini Me is, and how to get the app — a QR code on
// desktop, the store badges on a phone.
function GetAppModal({ onRequestClose, children }: { onRequestClose: () => void; children?: ReactNode }) {
  const isMobileDevice = useMainStore((state) => state.isMobileDevice)
  const css = useCss((_theme) => ({
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
        <img src={GET_APP_QR_CODE_URL} alt="QR Code" css={css.getAppQrImage} />
      </div>
    )
  }
  return (
    <ContentModal onRequestClose={onRequestClose} title={<TextT variant="brand" css={css.titleText} t="try_it_on" />}>
      <div>
        <TextT variant="brand" css={css.headerText} t="get-app.create_mini_me" />
      </div>
      <div>
        <TextT variant="base" t="landing.description" />
      </div>
      {getAppNode}
      {children}
      <PoweredByFooter />
    </ContentModal>
  )
}
