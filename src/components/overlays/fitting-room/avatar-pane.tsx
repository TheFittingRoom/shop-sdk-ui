import { ReactNode, useState } from 'react'
import { AvatarFrameViewer } from '@/components/avatar-frame-viewer'
import { Loading } from '@/components/content/loading'
import { TextT } from '@/components/text'
import { useCss } from '@/lib/theme'

interface AvatarPaneProps {
  // Resolved frame URLs (base-url applied) for the currently-active outfit,
  // null while frames haven't arrived yet, undefined when no outfit is active.
  frameUrls: string[] | null | undefined
  hasSelection: boolean
  // Optional control overlay (desktop only — see <AvatarControls>).
  controls?: ReactNode
}

// AvatarPane is the left-column avatar area on desktop and the background of
// the mobile try-on view.
// - No selection: show a "select items to try on" placeholder.
// - Outfit pending (no frames yet): show "Finding your perfect fit..." loader.
// - Outfit ready: render the frame carousel via <AvatarFrameViewer>.
export function AvatarPane({ frameUrls, hasSelection, controls }: AvatarPaneProps) {
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
  }))

  // Frame priority:
  // - frames present (bare avatar OR outfit VTO frames) → render the carousel.
  // - hasSelection but no frames yet → "Finding your perfect fit..." loader.
  // - no selection and no bare-avatar frames available → placeholder prompt.
  if (frameUrls && frameUrls.length > 0) {
    return (
      <div css={css.container}>
        <div css={css.frameSlot}>
          <AvatarFrameViewer
            frameUrls={frameUrls}
            selectedFrameIndex={selectedFrameIndex}
            setSelectedFrameIndex={setSelectedFrameIndex}
            imageContainerStyle={css.frameContainer}
            imageStyle={css.frameImage}
            loadingT="vto-single.avatar_loading"
          />
        </div>
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
