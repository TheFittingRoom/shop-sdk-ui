import { L } from '@locale'

import type { SizeErrorModalProps } from '@types'

export const SizeErrorModal = ({ isOpen = true, sizes, onNavBack, onClose }: SizeErrorModalProps) => {
  if (!isOpen) return null

  const handleNavBack = () => {
    onNavBack()
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <div className="tfr-modal tfr-modal-full">
      <div className="tfr-modal-content">
        <div className="tfr-mt-15-p tfr-mb-13-p">
          <div tfr-element="true" className="tfr-title-font tfr-light-22-300 tfr-c-black">
            {L.NoSizeAvailable} {sizes?.recommended} {L.OrSize} {sizes?.available?.join(' or ')}
          </div>
        </div>

        <div className="tfr-t-a-center">
          <span
            id="tfr-back"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20"
            onClick={handleNavBack}
          >
            {L.ReturnToCatalogPage || 'Return to Catalog Page'}
          </span>
          <span
            id="tfr-close"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor"
            onClick={handleClose}
          >
            {L.ReturnToProductPage || 'Return to Product Page'}
          </span>
        </div>
      </div>
    </div>
  )
}
