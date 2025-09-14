import { useModalContext } from '@contexts/modal-context'
import { useEffect } from 'preact/hooks'

interface ModalPortalProps {
  containerId: string
}

export const ModalPortal = ({ containerId }: ModalPortalProps) => {
  const modalManager = useModalContext()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalManager.isOpen) {
        modalManager.closeModal()
      }
    }

    const handleBackdropClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('tfr-modal-backdrop')) {
        modalManager.closeModal()
      }
    }

    if (modalManager.isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('click', handleBackdropClick)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('click', handleBackdropClick)
      document.body.style.overflow = ''
    }
  }, [modalManager.isOpen])

  if (!modalManager.isOpen || !modalManager.currentModal) return null

  return (
    <div id={containerId}>
      <div
        class="tfr-modal-backdrop"
        // onKeydown={handleKeyDown}
        // onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        {modalManager.currentModal}
      </div>
    </div>
  )
}
