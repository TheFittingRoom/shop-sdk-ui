import { useModalContext } from '@contexts/modal-context'
import { useState } from 'preact/hooks'
import { ScanCodeModal } from './scan-code-modal'
import { SignInModalContainer } from './sign-in-modal-container'

export const ScanCodeModalContainer = () => {
  const [tel, setTel] = useState('')
  const [error, setError] = useState('')

  const modalManager = useModalContext()

  const handleClose = () => {
    modalManager.closeModal()
    setTel('')
    setError('')
  }

  const handleTelSubmit = async (tel: string) => {
    // Phone submission not implemented yet
    console.log('Phone submission:', tel)
    setError('Phone submission not yet implemented')
  }

  const handleNavToSignIn = () => {
    console.log('[DEBUG] handleNavToSignIn clicked!')
    console.log('[DEBUG] modalManager:', modalManager)
    modalManager.pushModal(<SignInModalContainer />)
    console.log('[DEBUG] pushModal called')
  }

  return (
    <ScanCodeModal
      isOpen={true}
      tel={tel}
      error={error}
      onClose={handleClose}
      onTelChange={setTel}
      onTelSubmit={handleTelSubmit}
      onSignInNav={handleNavToSignIn}
    />
  )
}
