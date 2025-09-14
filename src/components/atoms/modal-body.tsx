import type { PropsWithChildren } from 'preact/compat'

interface ModalBodyProps extends PropsWithChildren {
  className?: string
}

export const ModalBody = ({ className = '', children }: ModalBodyProps) => {
  return <div className={`tfr-modal-body ${className}`}>{children}</div>
}
