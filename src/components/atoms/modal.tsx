import type { PropsWithChildren } from 'preact/compat'

interface ModalProps extends PropsWithChildren {
  isOpen: boolean
  onClose?: () => void
  className?: string
  ariaLabel?: string
  ariaDescribedBy?: string
  allowClose?: boolean
}

export const Modal = ({
  isOpen,
  onClose,
  className = '',
  children,
  ariaLabel,
  ariaDescribedBy,
  allowClose = true,
}: ModalProps) => {
  if (!isOpen) return null

  const handleClose = () => {
    if (allowClose && onClose) {
      onClose()
    }
  }

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }

  return (
    <div className="tfr-modal" id="tfr-modal-background" onClick={handleBackdropClick} role="presentation">
      <div className="tfr-modal-content-container tfr-p-20">
        <div className="tfr-modal-content-flex">
          <div
            className={`tfr-modal-content ${className}`}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
