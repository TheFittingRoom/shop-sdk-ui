import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { AvatarFrameViewer } from '@/components/avatar-frame-viewer'
import { Loading } from '@/components/content/loading'
import { TextT } from '@/components/text'
import { useAutoRotate } from '@/components/use-auto-rotate'
import { useFramePreload } from '@/components/use-frame-preload'
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
  // texture (matches quick-view's mobile layout).
  mobileFullscreen?: boolean
  // Optional controlled frame index. When omitted, AvatarPane keeps its own
  // internal state; desktop passes these so the zoom modal can show the
  // currently-displayed frame.
  selectedFrameIndex?: number | null
  setSelectedFrameIndex?: Dispatch<SetStateAction<number | null>>
  // Bump this from the parent each time a new product is added to the
  // outfit to trigger an auto-rotate animation. Undefined when dormant
  // (bare-avatar baseline before the first product is added). Size/color
  // changes — which replace frameUrls without bumping the trigger — are
  // ignored. See use-auto-rotate.ts for the contract.
  autoRotateTrigger?: number
  // Optional out-param: AvatarPane publishes its auto-rotate cancel callback
  // here so siblings that share `selectedFrameIndex` — specifically the
  // desktop zoom modal — can halt an in-flight rotation too. Without it a
  // rotation started behind the modal keeps advancing frames while the user
  // is rotating inside it, and the two fight over the same index.
  //
  // useAutoRotate stays hosted here rather than moving up to the layout: the
  // inner viewer unmounts across frameUrls null↔ready transitions, and this
  // component is the closest ancestor that does not.
  cancelAutoRotateRef?: MutableRefObject<(() => void) | null>
}

// AvatarPane is the left-column avatar area on desktop and the background of
// the mobile try-on view.
// - No selection: show a "select items to try on" placeholder.
// - Outfit pending (no frames yet): show "Finding your perfect fit..." loader.
// - Outfit ready: render the frame carousel via <AvatarFrameViewer>.
export function AvatarPane({
  frameUrls,
  hasSelection,
  controls,
  mobileFullscreen,
  selectedFrameIndex: indexProp,
  setSelectedFrameIndex: setIndexProp,
  autoRotateTrigger,
  cancelAutoRotateRef,
}: AvatarPaneProps) {
  const [localFrameIndex, setLocalFrameIndex] = useState<number | null>(null)
  // Controlled when the caller supplies an index; otherwise self-managed.
  const selectedFrameIndex = indexProp !== undefined ? indexProp : localFrameIndex
  const setSelectedFrameIndex = setIndexProp ?? setLocalFrameIndex

  // AvatarPane stays mounted across frameUrls null↔ready loading transitions
  // (the inner viewer unmounts during the "Finding your perfect fit" loader),
  // so the trigger-comparison ref inside this hook persists correctly.
  // Preload + decode the whole set before animating. The fitting room had no
  // preloading at all, so every frame of the first rotation was a cold fetch
  // of a full-size image (WEB-12).
  const { allSettled } = useFramePreload(frameUrls)

  const cancelAutoRotate = useAutoRotate(
    autoRotateTrigger,
    frameUrls,
    selectedFrameIndex,
    setSelectedFrameIndex,
    allSettled,
  )

  useEffect(() => {
    if (!cancelAutoRotateRef) {
      return
    }
    cancelAutoRotateRef.current = cancelAutoRotate
    return () => {
      cancelAutoRotateRef.current = null
    }
  }, [cancelAutoRotateRef, cancelAutoRotate])

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
        loadingT="quick-view.avatar_loading"
        onUserInteract={cancelAutoRotate}
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
        <Loading t="quick-view.avatar_loading" />
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
