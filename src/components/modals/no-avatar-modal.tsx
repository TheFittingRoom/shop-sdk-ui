import { L } from '@locale'

import type { NoAvatarModalProps } from '@types'

export const NoAvatarModal = ({ isOpen = true, onClose: _ }: NoAvatarModalProps) => {
  if (!isOpen) return null

  return (
    <div className="tfr-modal tfr-modal-full">
      <div className="tfr-modal-content">
        <div tfr-element="true" className="tfr-title-font tfr-light-22-300 tfr-c-black tfr-mt-60">
          {L.DontHaveAvatar}
        </div>
        <div tfr-element="true" className="tfr-title-font tfr-light-22-300 tfr-c-black tfr-mb-60">
          {L.ReturnToTfr}
        </div>
      </div>
    </div>
  )
}
