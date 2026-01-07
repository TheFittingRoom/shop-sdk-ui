import { CSSProperties, ReactNode } from 'react'
import ModalBase from 'react-modal'
import { Text } from '@/components/text'
import { ArrowBackIcon, CloseIcon } from '@/lib/asset'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { DeviceLayout } from '@/lib/view'

export interface ModalFrameProps {
  isOpen: boolean
  onRequestClose: () => void
  contentStyle: CSSProperties
  children: ReactNode
}

export function ModalFrame({ isOpen, onRequestClose, contentStyle, children }: ModalFrameProps) {
  const styleProp: { overlay: CSSProperties; content: CSSProperties } = {
    overlay: {
      zIndex: 1000,
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
}

export function ContentModal({ onRequestClose, title, onBackClick, children }: ContentModalProps) {
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
    body: {
      margin: '16px',
      overflowY: 'auto',
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
  }))

  return (
    <ModalFrame
      isOpen
      onRequestClose={onRequestClose}
      contentStyle={deviceLayout === DeviceLayout.MOBILE_PORTRAIT ? css.frameContentFullScreen : css.frameContentBase}
    >
      <ModalTitlebar title={title} onBackClick={onBackClick} onCloseClick={onRequestClose} />
      <div css={css.body}>
        <div css={css.contentContainer}>{children}</div>
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
  } else {
    titleNode = title
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
  onRequestClose: () => void
  children: ReactNode
}

export function SidecarModalFrame({ onRequestClose, children }: SidecarModalFrameProps) {
  const deviceLayout = useMainStore((state) => state.deviceLayout)
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
      backgroundColor: '#FFFFFF',
    },
  }))
  return (
    <ModalFrame
      isOpen
      onRequestClose={onRequestClose}
      contentStyle={deviceLayout === DeviceLayout.MOBILE_PORTRAIT ? css.frameContentFullScreen : css.frameContentBase}
    >
      {children}
    </ModalFrame>
  )
}
