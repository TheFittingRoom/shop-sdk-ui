import { CSSProperties, ReactNode } from 'react'
import ModalBase from 'react-modal'
import { Text } from '@/components/text'
import { ArrowBackIcon, CloseIcon } from '@/lib/asset'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'

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
  const deviceView = useMainStore((state) => state.deviceView)
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
    },
    frameContentFullScreen: {
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#FFFFFF',
      padding: '16px',
    },
    titlebar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titlebarBackButton: {
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
    },
    titlebarBackIcon: {
      width: '24px',
      height: '24px',
    },
    titlebarContent: {},
    titlebarCloseButton: {
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
    },
    titlebarCloseIcon: {
      width: '16px',
      height: '16px',
    },
    titleText: {
      textTransform: 'uppercase',
    },
    body: {
      margin: '16px',
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
      <button onClick={onBackClick} aria-label="Back" css={css.titlebarBackButton}>
        <ArrowBackIcon css={css.titlebarBackIcon} />
      </button>
    )
  } else {
    backNode = <div>&nbsp;</div>
  }

  return (
    <ModalFrame
      isOpen
      onRequestClose={onRequestClose}
      contentStyle={deviceView === 'mobile' ? css.frameContentFullScreen : css.frameContentBase}
    >
      <div css={css.titlebar}>
        {backNode}
        <div css={css.titlebarContent}>{title}</div>
        <button onClick={onRequestClose} aria-label="Close modal" css={css.titlebarCloseButton}>
          <CloseIcon css={css.titlebarCloseIcon} />
        </button>
      </div>
      <div css={css.body}>
        <div css={css.contentContainer}>{children}</div>
      </div>
    </ModalFrame>
  )
}
