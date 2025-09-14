import { Modal } from '@atoms/modal'
import { ModalBody } from '@atoms/modal-body'
import { ModalHeader } from '@atoms/modal-header'
import { L } from '@components/locale'

interface ErrorModalProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
  onRetry?: () => void
  onNavBack?: () => void
}

export const ErrorModal = ({ isOpen, message, onClose, onNavBack }: ErrorModalProps) => {
  const handleBack = () => {
    if (onNavBack) {
      onNavBack()
    } else {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Error">
      <ModalHeader onClose={onClose} />

      <ModalBody>
        <div className="tfr-mt-15-p tfr-mb-13-p">
          <div tfr-element="true" className="tfr-title-font tfr-light-22-300 tfr-c-black">
            {message || L.SomethingWentWrong}
          </div>
        </div>

        <div className="tfr-t-a-center">
          <span
            id="tfr-back"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20"
            onClick={handleBack}
          >
            {L.ReturnToCatalogPage}
          </span>
          <span
            id="tfr-close"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor"
            onClick={onClose}
          >
            {L.ReturnToProductPage}
          </span>
        </div>
      </ModalBody>
    </Modal>
  )
}
