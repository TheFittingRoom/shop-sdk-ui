import { useCallback, useState } from 'react'
import { ButtonT } from '@/components/button'
import { LinkT } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { TextT } from '@/components/text'
import { PoweredByFooter } from '@/components/content/powered-by-footer'
import { getExternalAssetUrl } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { OverlayProps } from '@/lib/view'
import { OverlayName } from '@/lib/view'

export interface LandingOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

// LandingOverlay is what a signed-out shopper sees on opening a try-on. Two
// ways in: an account with a demo avatar straight away (sign-up), or the app,
// to scan for their own Mini Me. Sign in is below for existing accounts.
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
      textAlign: 'center',
    },
    videoContainer: {
      marginTop: '16px',
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
    },
    // The poster and the video share one square box, so starting playback
    // moves nothing. Capped to a share of the screen: with the demo account
    // buttons the screen is tall enough that a full-size square pushes the
    // sign-in line under the pinned "Powered by" footer on shorter screens
    // (and with storefront fonts, which run larger).
    media: {
      display: 'block',
      width: 'min(100%, 30vh)',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      backgroundColor: '#11272b',
    },
    posterButton: {
      position: 'relative',
      display: 'block',
      padding: 0,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      width: 'min(100%, 30vh)',
    },
    posterImage: {
      display: 'block',
      width: '100%',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
    },
    // Drawn here rather than baked into the poster, so it stays crisp at any
    // size and the poster is just a frame of the video.
    playIcon: {
      position: 'absolute',
      inset: 0,
      margin: 'auto',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '16px',
        left: '22px',
        borderStyle: 'solid',
        borderWidth: '12px 0 12px 19px',
        borderColor: 'transparent transparent transparent #FFFFFF',
      },
    },
    demoCta: {
      marginTop: '16px',
      fontSize: '14px',
      textAlign: 'center',
    },
    buttonContainer: {
      marginTop: '8px',
      width: '100%',
    },
    or: {
      marginTop: '8px',
      fontSize: '14px',
    },
    signInContainer: {
      marginTop: '16px',
    },
  }))
  // The intro video, and its poster (a frame of it). Tapping the poster plays
  // the video in its place. The video has no sound track.
  const videoUrl = getExternalAssetUrl('intro-video.mp4')
  const posterUrl = getExternalAssetUrl('intro-video-poster.jpg')
  const [playing, setPlaying] = useState(false)

  const handleDemoAccountClick = useCallback(() => {
    openOverlay(OverlayName.SIGN_UP, { returnToOverlay })
  }, [openOverlay, returnToOverlay])
  const handleGetAppClick = useCallback(() => {
    openOverlay(OverlayName.GET_APP, { returnToOverlay })
  }, [openOverlay, returnToOverlay])
  const handleSignInClick = useCallback(() => {
    openOverlay(OverlayName.SIGN_IN, { returnToOverlay })
  }, [openOverlay, returnToOverlay])

  return (
    <ContentModal onRequestClose={closeOverlay} title={<TextT variant="brand" css={css.titleText} t="try_it_on" />}>
      <div css={css.headerText}>
        <TextT variant="brand" css={css.headerText} t={t('landing.header')} />
      </div>
      <div css={css.description}>
        <TextT variant="base" t={t('landing.description')} />
      </div>
      <div css={css.videoContainer}>
        {playing ? (
          // playsInline keeps iPhones from forcing fullscreen; muted is what
          // lets autoplay start everywhere (there is no audio to lose).
          <video
            src={videoUrl}
            poster={posterUrl}
            css={css.media}
            autoPlay
            muted
            playsInline
            controls
            aria-label={t('landing.intro_video')}
          />
        ) : (
          <button
            type="button"
            css={css.posterButton}
            onClick={() => setPlaying(true)}
            aria-label={t('landing.play_video')}
          >
            <img src={posterUrl} alt="" css={css.posterImage} />
            <span css={css.playIcon} />
          </button>
        )}
      </div>
      <TextT variant="base" css={css.demoCta} t="landing.try_before_you_scan" />
      <div css={css.buttonContainer}>
        <ButtonT onClick={handleDemoAccountClick} variant="secondary" t="landing.demo_account" />
      </div>
      <TextT variant="base" css={css.or} t="landing.or" />
      <div css={css.buttonContainer}>
        <ButtonT onClick={handleGetAppClick} variant="primary" t="mini_me.create" />
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
