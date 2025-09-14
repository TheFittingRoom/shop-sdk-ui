import { useAuthContext, useModalContext } from '@contexts/index'
import { useState } from 'preact/hooks'
import { ForgotPasswordModal } from './forgot-password-modal'
import { SignInModal } from './sign-in-modal'

export const SignInModalContainer = () => {
  const [emailValue, setEmailValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const modalManager = useModalContext()
  const auth = useAuthContext()

  const handleClose = () => {
    modalManager.closeModal()
    setEmailValue('')
    setPasswordValue('')
    setValidationError('')
    setIsSubmitting(false)
  }

  const handleSignIn = async (email: string, password: string) => {
    setValidationError('')
    setIsSubmitting(true)

    try {
      const result = await auth.signIn(email, password)
      if (result) {
        modalManager.closeAll()
      } else {
        setValidationError('Invalid email or password')
      }
    } catch (_error) {
      setValidationError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNavToForgotPassword = (email?: string) => {
    modalManager.pushModal(<ForgotPasswordModalContainer initialEmail={email} />)
  }

  const handleNavToScanCode = () => {
    modalManager.popModal()
  }

  return (
    <SignInModal
      isOpen={true}
      emailValue={emailValue}
      passwordValue={passwordValue}
      validationError={validationError}
      isSubmitting={isSubmitting}
      onClose={handleClose}
      onEmailChange={setEmailValue}
      onPasswordChange={setPasswordValue}
      onSignIn={handleSignIn}
      onNavForgotPassword={handleNavToForgotPassword}
      onNavScanCode={handleNavToScanCode}
    />
  )
}

interface ForgotPasswordModalContainerProps {
  initialEmail?: string
}

export const ForgotPasswordModalContainer = ({ initialEmail = '' }: ForgotPasswordModalContainerProps) => {
  const [emailValue, setEmailValue] = useState(initialEmail)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const modalManager = useModalContext()
  const auth = useAuthContext()

  const handleClose = () => {
    modalManager.closeModal()
  }

  const handlePasswordReset = async (email: string) => {
    setIsSubmitting(true)
    setError('')

    try {
      await auth.sendPasswordReset(email)
    } catch (_err) {
      setError('Failed to send reset email. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNavToScanCode = () => {
    modalManager.popModal()
  }

  const handleNavBackToSignIn = () => {
    modalManager.popModal()
  }

  return (
    <ForgotPasswordModal
      isOpen={true}
      emailValue={emailValue}
      validationError={error}
      isSubmitting={isSubmitting}
      onClose={handleClose}
      onEmailChange={setEmailValue}
      onNavSignIn={handleNavBackToSignIn}
      onPasswordReset={handlePasswordReset}
      onNavScanCode={handleNavToScanCode}
    />
  )
}
