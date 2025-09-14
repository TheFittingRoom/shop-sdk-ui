import type { PropsWithChildren } from 'preact/compat'
import { Button } from './button'

interface ModalHeaderProps extends PropsWithChildren {
  title?: string
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

export const ModalHeader = ({ title, onClose, showCloseButton = true, className = '', children }: ModalHeaderProps) => {
  return (
    <div className={`tfr-modal-header ${className}`}>
      {children || (title && <h2 className="tfr-modal-title">{title}</h2>)}
      {showCloseButton && onClose && (
        <Button variant="ghost" size="small" className="tfr-modal-close" onClick={onClose} ariaLabel="Close modal">
          ×
        </Button>
      )}
    </div>
  )
}
