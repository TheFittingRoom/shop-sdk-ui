import { Button } from '@atoms/button'
import { Modal } from '@atoms/modal'
import { ModalBody } from '@atoms/modal-body'
import { ModalHeader } from '@atoms/modal-header'
import { L } from '@components/locale'

import clsx from 'clsx'

interface SignInModalProps {
  isOpen: boolean
  emailValue: string
  passwordValue: string
  validationError: string
  isSubmitting: boolean
  onClose: () => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSignIn: (email: string, password: string) => void
  onNavForgotPassword: (email?: string) => void
  onNavScanCode: () => void
}

export const SignInModal = ({
  isOpen,
  emailValue,
  passwordValue,
  validationError,
  isSubmitting,
  onClose,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onNavForgotPassword,
  onNavScanCode,
}: SignInModalProps) => {
  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    onSignIn(emailValue, passwordValue)
  }

  const handleEmailInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    onEmailChange(target.value)
  }

  const handlePasswordInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    onPasswordChange(target.value)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Sign In" allowClose={!isSubmitting}>
      <ModalHeader onClose={onClose} />

      <ModalBody>
        <form id="tfr-sign-in-form" onSubmit={handleSubmit}>
          <div className="tfr-title-font tfr-light-22-300 tfr-mt-10">{L.SignIn}</div>

          <fieldset
            className={clsx('tfr-fieldset-element', 'tfr-fieldset', 'tfr-mt-20', {
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
              id="email-input"
              value={emailValue}
              onInput={handleEmailInput}
              required
              disabled={isSubmitting}
            />
          </fieldset>

          <fieldset
            className={clsx('tfr-fieldset-element', 'tfr-fieldset', 'tfr-mt-20', {
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
              {L.Password}
            </legend>
            <input
              tfr-element="true"
              type="password"
              id="password-input"
              value={passwordValue}
              onInput={handlePasswordInput}
              required
              disabled={isSubmitting}
            />
          </fieldset>

          {validationError && (
            <div
              tfr-element="true"
              id="tfr-form-error"
              className="tfr-body-font tfr-12-default tfr-c-red tfr-mt-10 tfr-d-block"
            >
              {validationError}
            </div>
          )}

          <div className="tfr-mt-20">
            <span
              id="tfr-forgot-password"
              tfr-element="true"
              className="tfr-body-font tfr-14-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-15"
              onClick={() => !isSubmitting && onNavForgotPassword(emailValue)}
              style={{ pointerEvents: isSubmitting ? 'none' : 'auto' }}
            >
              {L.ForgotPasswordWithSymbol}
            </span>
            <span
              id="tfr-scan-code"
              tfr-element="true"
              className="tfr-body-font tfr-14-default tfr-c-black-o5 tfr-underline tfr-cursor"
              onClick={() => !isSubmitting && onNavScanCode()}
              style={{ pointerEvents: isSubmitting ? 'none' : 'auto' }}
            >
              {L.DontHaveAcc}
            </span>
          </div>

          <Button
            id="tfr-sign-in"
            tfr-element="true"
            className="tfr-standard-button tfr-c-brand-bg tfr-c-white tfr-title-font tfr-medium-16-default tfr-cursor tfr-mt-30"
            type="submit"
            disabled={isSubmitting}
          >
            {L.SignIn}
          </Button>
        </form>
      </ModalBody>
    </Modal>
  )
}
