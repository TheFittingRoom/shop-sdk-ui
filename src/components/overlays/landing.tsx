import { useCallback } from 'react'
import { ButtonT } from '@/components/button'
import { LinkT } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { TextT } from '@/components/text'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { getExternalAssetUrl } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName, OverlayProps } from '@/lib/view'

export interface LandingOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

export default function LandingOverlay({ returnToOverlay }: LandingOverlayProps) {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const css = useCss((_theme) => ({
    titleText: {
      textTransform: 'uppercase',
    },
    headerText: {
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
    signInContainer: {
      marginTop: '16px',
    },
  }))
  const videoThumbnailUrl = getExternalAssetUrl('intro-video-thumbnail.png')

  const handleGetAppClick = useCallback(() => {
    openOverlay(OverlayName.GET_APP, { returnToOverlay })
  }, [returnToOverlay])
  const handleSignInClick = useCallback(() => {
    openOverlay(OverlayName.SIGN_IN, { returnToOverlay })
  }, [returnToOverlay])

  return (
    <ContentModal onRequestClose={closeOverlay} title={<TextT variant="brand" css={css.titleText} t="try_it_on" />}>
      <div css={css.headerText}>
        <TextT variant="brand" css={css.headerText} t={t('landing.header')} />
      </div>
      <div css={css.description}>
        <TextT variant="base" t={t('landing.description')} />
      </div>
      <div css={css.videoContainer}>
        <img src={videoThumbnailUrl} alt="intro video thumbnail" css={css.videoThumbnailImage} />
      </div>
      <div css={css.buttonContainer}>
        <ButtonT onClick={handleGetAppClick} variant="primary" t="landing.get_the_app" />
      </div>
      <div css={css.signInContainer}>
        <TextT variant="base" t={t('landing.already_have_account')} />
        &nbsp;
        <LinkT onClick={handleSignInClick} variant="semibold" t="landing.sign_in" />
      </div>
      <PoweredByFooter />
    </ContentModal>
  )
}
