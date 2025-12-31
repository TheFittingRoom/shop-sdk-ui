import { CSSProperties, ReactNode } from 'react'
import ModalBase from 'react-modal'
import { Text } from '@/components/text'
import { ArrowBackIcon, CloseIcon } from '@/lib/asset'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'

export type ModalVariant = 'medium' | 'large' | 'full-screen'

export interface ModalProps {
  isOpen: boolean
  onRequestClose: () => void
  title: ReactNode
  variant: ModalVariant
  onBackClick?: () => void
  children: ReactNode
}

const VARIANT_FRAME_CONTENT_STYLES: Record<ModalVariant, CSSProperties> = {
  medium: {
    width: '540px',
    height: undefined,
  },
  large: {
    width: undefined,
    height: undefined,
  },
  'full-screen': {
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
  },
}

export function Modal({ isOpen, onRequestClose, title, variant, onBackClick, children }: ModalProps) {
  const deviceView = useMainStore((state) => state.deviceView)
  if (deviceView === 'mobile') {
    variant = 'full-screen'
  }
  const css = useCss((theme) => {
    const variantFrameContentStyles = VARIANT_FRAME_CONTENT_STYLES[variant]
    return {
      frameOverlay: {
        zIndex: 1000,
      },
      frameContent: {
        marginLeft: 'auto',
        marginRight: 'auto',
        backgroundColor: '#FFFFFF',
        borderColor: theme.color_tfr_800,
        borderStyle: 'solid',
        borderWidth: '1px',
        padding: '16px',
        ...variantFrameContentStyles,
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
      body: {
        margin: '16px',
      },
    }
  })
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
    <ModalBase
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{ overlay: css.frameOverlay, content: css.frameContent }}
      bodyOpenClassName="tfr-modal-open"
    >
      <div css={css.titlebar}>
        {backNode}
        <div css={css.titlebarContent}>{title}</div>
        <button onClick={onRequestClose} aria-label="Close modal" css={css.titlebarCloseButton}>
          <CloseIcon css={css.titlebarCloseIcon} />
        </button>
      </div>
      <div css={css.body}>{children}</div>
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
  const css = useCss((_theme) => ({
    title: {
      textTransform: 'uppercase',
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
    titleNode = <Text variant="base" css={css.title}>{title}</Text>
  } else {
    titleNode = title
  }
  return (
    <Modal
      isOpen
      onRequestClose={onRequestClose}
      variant="medium"
      onBackClick={onBackClick}
      title={titleNode}
    >
      <div css={css.contentContainer}>
        {children}
      </div>
    </Modal>
  )
}
