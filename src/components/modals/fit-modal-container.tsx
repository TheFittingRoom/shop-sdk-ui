import { useModalContext } from '@contexts/index'

import { FitModal } from './fit-modal'
import { ScanCodeModalContainer } from './scan-code-modal-container'

export const FitModalContainer = () => {
  const modalManager = useModalContext()

  const handleClose = () => {
    modalManager.closeModal()
  }

  const handleSignInNav = () => {
    modalManager.pushModal(<ScanCodeModalContainer />)
  }

  return <FitModal isOpen={true} onClose={handleClose} onSignInNav={handleSignInNav} />
}
