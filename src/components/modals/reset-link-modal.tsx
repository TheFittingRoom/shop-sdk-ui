import { L } from '@locale'

import type { ResetLinkModalProps } from '@types'

export const ResetLinkModal = ({ isOpen = true, email, onNavSignIn, onClose: _ }: ResetLinkModalProps) => {
  if (!isOpen) return null

  const handleBackToSignIn = () => {
    onNavSignIn(email || '')
  }

  return (
    <div className="tfr-modal tfr-modal-full">
      <div className="tfr-modal-content">
        <div
          tfr-element="true"
          className="tfr-title-font tfr-light-22-300 tfr-c-black tfr-mt-15-p tfr-mb-13-p tfr-w-80-p tfr-m-h-auto"
        >
          {L.AssociatedEmail}
        </div>
        <div className="tfr-t-a-center">
          <span
            id="tfr-back-to-signin"
            tfr-element="true"
            className="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20"
            onClick={handleBackToSignIn}
          >
            {L.BackToSignIn}
          </span>
        </div>
      </div>
    </div>
  )
}
