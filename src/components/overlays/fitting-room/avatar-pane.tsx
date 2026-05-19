import { ReactNode, useState } from 'react'
import { AvatarFrameViewer } from '@/components/avatar-frame-viewer'
import { Loading } from '@/components/content/loading'
import { TextT } from '@/components/text'
import { AVATAR_BOTTOM_BACKGROUND_URL } from '@/lib/asset'
import { useCss } from '@/lib/theme'

interface AvatarPaneProps {
  // Resolved frame URLs (base-url applied) for the currently-active outfit,
  // null while frames haven't arrived yet, undefined when no outfit is active.
  frameUrls: string[] | null | undefined
  hasSelection: boolean
  // Optional control overlay (desktop only — see <AvatarControls>).
  controls?: ReactNode
  // Mobile try-on: anchor the avatar frame to the top at its natural 2:3
  // aspect and fill the area below it with the avatar-bottom background
  // texture (matches vto-single's mobile layout).
  mobileFullscreen?: boolean
}

// AvatarPane is the left-column avatar area on desktop and the background of
// the mobile try-on view.
// - No selection: show a "select items to try on" placeholder.
// - Outfit pending (no frames yet): show "Finding your perfect fit..." loader.
// - Outfit ready: render the frame carousel via <AvatarFrameViewer>.
export function AvatarPane({ frameUrls, hasSelection, controls, mobileFullscreen }: AvatarPaneProps) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null)

  const css = useCss((theme) => ({
    container: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FAFAFA',
      color: theme.color_fg_text,
      fontSize: '14px',
      position: 'relative',
    },
    placeholder: {
      padding: '32px',
      textAlign: 'center',
    },
    frameSlot: {
      position: 'relative',
      width: '100%',
      height: '100%',
    },
    frameContainer: {
      position: 'absolute',
      inset: 0,
    },
    frameImage: {
      width: '100%',
      height: '100%',
    },
    // Mobile try-on: column with the avatar pinned to the top at its 2:3
    // aspect, the bottom-background texture filling whatever's left below.
    mobileContainer: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      backgroundColor: '#FFFFFF',
      position: 'relative',
    },
    mobileFrameSlot: {
      position: 'relative',
      width: '100%',
      aspectRatio: '2 / 3',
      flex: 'none',
    },
    bottomFiller: {
      flex: 1,
      minHeight: 0,
      backgroundColor: '#FFFFFF',
      backgroundImage: `url(${AVATAR_BOTTOM_BACKGROUND_URL})`,
      backgroundSize: 'contain',
      backgroundRepeat: 'repeat-y',
      backgroundPosition: 'top center',
    },
  }))

  // Frame priority:
  // - frames present (bare avatar OR outfit VTO frames) → render the carousel.
  // - hasSelection but no frames yet → "Finding your perfect fit..." loader.
  // - no selection and no bare-avatar frames available → placeholder prompt.
  if (frameUrls && frameUrls.length > 0) {
    const viewer = (
      <AvatarFrameViewer
        frameUrls={frameUrls}
        selectedFrameIndex={selectedFrameIndex}
        setSelectedFrameIndex={setSelectedFrameIndex}
        imageContainerStyle={css.frameContainer}
        imageStyle={css.frameImage}
        loadingT="vto-single.avatar_loading"
      />
    )
    if (mobileFullscreen) {
      return (
        <div css={css.mobileContainer}>
          {/* controls sit inside the frame slot so they anchor to the bottom
              of the VTO image, not the bottom of the whole column. */}
          <div css={css.mobileFrameSlot}>
            {viewer}
            {controls}
          </div>
          {/* The nbsp keeps this div non-empty: the merchant theme's global
              `div:empty { display: none }` rule (higher specificity than an
              emotion class) would otherwise hide the filler entirely. */}
          <div css={css.bottomFiller}>&nbsp;</div>
        </div>
      )
    }
    return (
      <div css={css.container}>
        <div css={css.frameSlot}>{viewer}</div>
        {controls}
      </div>
    )
  }

  // Loading state — controls are intentionally hidden here. There's no
  // rendered outfit to act on yet, so the pills would be controlling nothing.
  if (hasSelection) {
    return (
      <div css={css.container}>
        <Loading t="vto-single.avatar_loading" />
      </div>
    )
  }

  return (
    <div css={css.container}>
      <div css={css.placeholder}>
        <TextT variant="base" t="fitting_room.avatar_placeholder_empty" />
      </div>
      {controls}
    </div>
  )
}
