import { Button } from '@atoms/button'
import { Modal } from '@atoms/modal'
import { ModalBody } from '@atoms/modal-body'
import { ModalHeader } from '@atoms/modal-header'
import { L } from '@components/locale'

import clsx from 'clsx'

interface ForgotPasswordModalProps {
  isOpen: boolean
  emailValue: string
  validationError: string
  isSubmitting: boolean
  onClose: () => void
  onEmailChange: (value: string) => void
  onPasswordReset: (email: string) => void
  onNavSignIn: () => void
  onNavScanCode: () => void
}

export const ForgotPasswordModal = ({
  isOpen,
  emailValue,
  validationError,
  isSubmitting,
  onClose,
  onEmailChange,
  onPasswordReset,
  onNavSignIn,
  onNavScanCode: _,
}: ForgotPasswordModalProps) => {
  const handleEmailInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    onEmailChange(target.value)
  }

  const handlePasswordReset = () => {
    onPasswordReset(emailValue)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Forgot Password" allowClose={!isSubmitting}>
      <ModalHeader onClose={onClose} />

      <ModalBody>
        <div tfr-element="true" className="tfr-title-font tfr-light-16-300 tfr-mt-20 tfr-w-70-p tfr-m-h-auto">
          {L.EnterEmailAddress}
        </div>

        <fieldset
          className={clsx('tfr-fieldset-element', 'tfr-fieldset', 'tfr-mt-30', {
            'tfr-fieldset-err': validationError,
          })}
        >
          <legend
            tfr-element="true"
            className={clsx('tfr-label-element', 'tfr-body-font', 'tfr-14-default', {
              'tfr-c-red': validationError,
              'tfr-c-black-o5': !validationError,
            })}
          >
            {L.EmailAddress}
          </legend>
          <input
            tfr-element="true"
            type="email"
            id="tfr-email"
            value={emailValue}
            onInput={handleEmailInput}
            disabled={isSubmitting}
          />
        </fieldset>

        {validationError && (
          <div
            tfr-element="true"
            id="error-msg"
            className="tfr-body-font tfr-12-default tfr-c-red tfr-mt-10 tfr-d-block"
          >
            {validationError}
          </div>
        )}

        <div
          id="tfr-back-to-signin"
          tfr-element="true"
          className="tfr-body-font tfr-12-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mt-30"
          onClick={() => !isSubmitting && onNavSignIn()}
          style={{ pointerEvents: isSubmitting ? 'none' : 'auto' }}
        >
          {L.BackToSignIn}
        </div>

        <Button
          id="tfr-send-password-reset"
          tfr-element="true"
          className="tfr-standard-button tfr-c-brand-bg tfr-c-white tfr-title-font tfr-medium-16-default tfr-cursor tfr-mt-30"
          onClick={handlePasswordReset}
          type="button"
          disabled={isSubmitting}
        >
          {L.Send}
        </Button>
      </ModalBody>
    </Modal>
  )
}
