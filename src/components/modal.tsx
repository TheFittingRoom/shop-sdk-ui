import { CSSProperties, ReactNode } from 'react'
import ModalBase from 'react-modal'
import { CloseIcon } from '@/lib/asset'
import { useMainStore } from '@/lib/store'
import { useStyles } from '@/lib/theme'

export type ModalVariant = 'medium' | 'large' | 'full-screen'

export interface ModalProps {
  isOpen: boolean
  onRequestClose: () => void
  title: ReactNode
  variant: ModalVariant
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

export function Modal({ isOpen, onRequestClose, title, variant, children }: ModalProps) {
  const deviceView = useMainStore((state) => state.deviceView)
  if (deviceView === 'mobile') {
    variant = 'full-screen'
  }
  const styles = useStyles((theme) => {
    const variantFrameContentStyles = VARIANT_FRAME_CONTENT_STYLES[variant]
    return {
      frameOverlay: {
        zIndex: 1000,
      },
      frameContent: {
        marginLeft: 'auto',
        marginRight: 'auto',
        backgroundColor: theme.color_modal_bg,
        borderColor: theme.color_modal_border,
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
  return (
    <ModalBase
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{ overlay: styles.frameOverlay, content: styles.frameContent }}
      bodyOpenClassName="tfr-modal-open"
    >
      <div style={styles.titlebar}>
        <div>&nbsp;</div>
        <div style={styles.titlebarContent}>{title}</div>
        <button onClick={onRequestClose} aria-label="Close modal" style={styles.titlebarCloseButton}>
          <CloseIcon style={styles.titlebarCloseIcon} />
        </button>
      </div>
      <div style={styles.body}>{children}</div>
    </ModalBase>
  )
}
