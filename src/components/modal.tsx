import { CSSProperties, ReactNode } from 'react'
import ModalBase from 'react-modal'
import CloseIcon from '@/assets/close-icon.svg?react'
import { useStyles } from '@/lib/theme'

export type ModalVariant = 'medium' | 'large'

export interface ModalProps {
  isOpen: boolean
  onRequestClose: () => void
  title: ReactNode
  variant: ModalVariant
  children: ReactNode
}

const VARIANT_STYLES: Record<ModalVariant, CSSProperties> = {
  medium: {
    width: '540px',
    height: undefined,
  },
  large: {
    width: undefined,
    height: undefined,
  },
}

export function Modal({ isOpen, onRequestClose, title, variant, children }: ModalProps) {
  const styles = useStyles((theme) => {
    const variantStyles = VARIANT_STYLES[variant]
    return {
      frameOverlay: {
        zIndex: 1000,
      },
      frameContent: {
        marginLeft: 'auto',
        marginRight: 'auto',
        width: variantStyles.width,
        height: variantStyles.height,
        backgroundColor: theme.color_modal_bg,
        borderColor: theme.color_modal_border,
        borderStyle: 'solid',
        borderWidth: '1px',
        padding: '16px',
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
