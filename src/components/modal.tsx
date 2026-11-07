import type { ReactNode } from 'react'
import ModalBase from 'react-modal'
import { Text } from '@/components/text'
import { ArrowBackIcon, CloseIcon } from '@/lib/asset'
import { useMainStore } from '@/lib/store'
import type { StyleProp } from '@/lib/theme'
import { useCss } from '@/lib/theme'
import { DeviceLayout } from '@/lib/view'

export interface ModalFrameProps {
  isOpen: boolean
  onRequestClose: () => void
  contentStyle: StyleProp
  overlayStyle?: StyleProp
  children: ReactNode
}

export function ModalFrame({ isOpen, onRequestClose, contentStyle, overlayStyle, children }: ModalFrameProps) {
  const styleProp: { overlay: StyleProp; content: StyleProp } = {
    overlay: {
      zIndex: 1000,
      ...overlayStyle,
    },
    content: contentStyle,
  }
  return (
    <ModalBase isOpen={isOpen} onRequestClose={onRequestClose} style={styleProp} bodyOpenClassName="tfr-modal-open">
      {children}
    </ModalBase>
  )
}

export interface ContentModalProps {
  onRequestClose: () => void
  title: ReactNode
  onBackClick?: () => void
  children: ReactNode
  // fillHeight makes the body take the frame's whole height, less room for a
  // pinned PoweredByFooter, so a child with `flex: 1` (the landing screen's
  // video) can grow into whatever height the screen has. Without it the body
  // is as tall as its content and sits centred in the frame.
  fillHeight?: boolean
}

// FOOTER_SPACE is the bottom margin of a fillHeight body: it ends just above
// PoweredByFooter's logo row. That row is 24px tall and sits 16px above the
// frame's inner bottom edge; the body already stops 16px short of that edge
// (the frame's padding); and 8px of gap. The footer's own paddingTop is not
// counted: it is empty, and the footer ignores pointer events, so the body
// may run under it. (It was 64px, which counted all of that again and left
// 40px of blank space above the footer on a 720px-tall laptop screen.)
const FOOTER_SPACE = '32px'

export function ContentModal({ onRequestClose, title, onBackClick, children, fillHeight = false }: ContentModalProps) {
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const css = useCss((theme) => ({
    frameContentBase: {
      width: '540px',
      marginLeft: 'auto',
      marginRight: 'auto',
      backgroundColor: '#FFFFFF',
      borderColor: theme.color_tfr_800,
      borderStyle: 'solid',
      borderWidth: '1px',
      padding: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    },
    frameContentFullScreen: {
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#FFFFFF',
      padding: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    },
    // minHeight 0 lets the body shrink inside the fixed-height frame (a flex
    // item otherwise never goes below its content's height), so a modal taller
    // than the screen scrolls instead of being clipped with its buttons out of
    // reach — e.g. sign-up on a phone with every field showing an error.
    body: {
      margin: '16px',
      overflowY: 'auto',
      minHeight: 0,
    },
    bodyFill: {
      flex: '1 1 auto',
      display: 'flex',
      flexDirection: 'column',
      // Half the usual top margin: on a short screen every pixel is video.
      marginTop: '8px',
      marginBottom: FOOTER_SPACE,
    },
    contentContainer: {
      maxWidth: '390px',
      marginLeft: 'auto',
      marginRight: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      alignItems: 'center',
    },
    // Fills the body's height. As a flex item it never shrinks below its
    // content's minimum, so the body still scrolls when the screen is too
    // short for even the smallest layout.
    contentContainerFill: {
      flex: '1 0 auto',
      width: '100%',
    },
  }))

  return (
    <ModalFrame
      isOpen
      onRequestClose={onRequestClose}
      contentStyle={deviceLayout === DeviceLayout.MOBILE_PORTRAIT ? css.frameContentFullScreen : css.frameContentBase}
    >
      <ModalTitlebar title={title} onBackClick={onBackClick} onCloseClick={onRequestClose} />
      <div css={[css.body, fillHeight && css.bodyFill]}>
        <div css={[css.contentContainer, fillHeight && css.contentContainerFill]}>{children}</div>
      </div>
    </ModalFrame>
  )
}

export interface ModalTitlebarProps {
  title: ReactNode
  onBackClick?: () => void
  onCloseClick: () => void
}

export function ModalTitlebar({ title, onBackClick, onCloseClick }: ModalTitlebarProps) {
  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backButton: {
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
    },
    backIcon: {
      width: '24px',
      height: '24px',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
    },
    closeIcon: {
      width: '16px',
      height: '16px',
    },
    titleText: {
      textTransform: 'uppercase',
    },
  }))

  let titleNode: ReactNode
  if (typeof title === 'string') {
    titleNode = (
      <Text variant="base" css={css.titleText}>
        {title}
      </Text>
    )
  } else if (title) {
    titleNode = title
  } else {
    titleNode = <div>&nbsp;</div>
  }
  let backNode: ReactNode
  if (onBackClick) {
    backNode = (
      <button onClick={onBackClick} aria-label="Back" css={css.backButton}>
        <ArrowBackIcon css={css.backIcon} />
      </button>
    )
  } else {
    backNode = <div>&nbsp;</div>
  }

  return (
    <div css={css.container}>
      {backNode}
      <div>{titleNode}</div>
      <button onClick={onCloseClick} aria-label="Close modal" css={css.closeButton}>
        <CloseIcon css={css.closeIcon} />
      </button>
    </div>
  )
}

export interface SidecarModalFrameProps {
  contentStyle?: StyleProp
  onRequestClose: () => void
  children: ReactNode
}

export function SidecarModalFrame({ contentStyle, onRequestClose, children }: SidecarModalFrameProps) {
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const isMobileLayout = deviceLayout === DeviceLayout.MOBILE_PORTRAIT || deviceLayout === DeviceLayout.TABLET_PORTRAIT
  const css = useCss((_theme) => ({
    frameContentBase: {
      position: 'absolute',
      inset: '0 0 auto auto',
      width: 'max(min(1100px, 100vw), 80vw)',
      height: '100vh',
      margin: 0,
      padding: 0,
      border: 'none',
      backgroundColor: '#FFFFFF',
    },
    frameContentFullScreen: {
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      border: 'none',
      backgroundColor: '#FFFFFF',
    },
  }))
  const applyContentStyle = {
    ...(isMobileLayout ? css.frameContentFullScreen : css.frameContentBase),
    ...contentStyle,
  }
  return (
    <ModalFrame isOpen onRequestClose={onRequestClose} contentStyle={applyContentStyle}>
      {children}
    </ModalFrame>
  )
}
