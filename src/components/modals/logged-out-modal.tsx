import { L } from '@locale'

import type { LoggedOutModalProps } from '@types'

export const LoggedOutModal = ({ isOpen = true, onClose, onNavSignIn }: LoggedOutModalProps) => {
  if (!isOpen) return null

  const handleNavSignIn = () => {
    onNavSignIn('')
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <div className="tfr-modal tfr-modal-full">
      <div className="tfr-modal-content">
        <div tfr-element="true" className="tfr-title-font tfr-light-22-300 tfr-mt-15-p tfr-mb-13-p">
          {L.SuccessfullyLoggedOut}
        </div>
        <div className="tfr-t-a-center">
          <span
            id="tfr-sign-in"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20"
            onClick={handleNavSignIn}
          >
            {L.SignBackIn}
          </span>
          <span
            id="tfr-close"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor"
            onClick={handleClose}
          >
            {L.ReturnToSite}
          </span>
        </div>
      </div>
    </div>
  )
}
