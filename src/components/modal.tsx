import ModalBase from 'react-modal'

export interface ModalProps {
  isOpen: boolean
  onRequestClose: () => void
  children?: React.ReactNode
}

export function Modal({ isOpen, onRequestClose, children }: ModalProps) {
  return (
    <ModalBase
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{ overlay: { zIndex: 1000 } }}
      bodyOpenClassName="tfr-modal-open"
    >
      {children}
    </ModalBase>
  )
}
