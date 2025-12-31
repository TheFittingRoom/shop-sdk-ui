import { useCallback } from 'react'
import { Button } from '@/components/button'
import { Link } from '@/components/link'
import { ContentModal } from '@/components/modal'
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
  const css = useCss((theme) => ({
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
    signIn: {
      marginTop: '16px',
      fontSize: '16px',
    },
    signInLink: {
      color: theme.color_tfr_800,
      fontSize: '16px',
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
    <ContentModal
      onRequestClose={closeOverlay}
      title={t('try_it_on')}
    >
      <div css={css.header}>{t('landing.header')}</div>
      <div css={css.description}>{t('landing.description')}</div>
      <div css={css.videoContainer}>
        <img src={videoThumbnailUrl} alt="intro video thumbnail" css={css.videoThumbnailImage} />
      </div>
      <div css={css.buttonContainer}>
        <Button onClick={handleGetAppClick} variant="primary">
          {t('landing.get_the_app')}
        </Button>
      </div>
      <div css={css.signIn}>
        {t('landing.already_have_account')}{' '}
        <Link onClick={handleSignInClick} variant="base" css={css.signInLink}>
          {t('landing.sign_in')}
        </Link>
      </div>
      <PoweredByFooter />
    </ContentModal>
  )
}
