import type { PropsWithChildren } from 'preact/compat'

interface ModalFooterProps extends PropsWithChildren {
  className?: string
}

export const ModalFooter = ({ className = '', children }: ModalFooterProps) => {
  return <div className={`tfr-modal-footer ${className}`}>{children}</div>
}
