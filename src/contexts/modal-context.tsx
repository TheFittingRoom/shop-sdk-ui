import { useModalManager } from '@hooks/use-modal-manager'
import { createContext } from 'preact'
import type { PropsWithChildren } from 'preact/compat'
import { useContext } from 'preact/hooks'

export type ModalContextValue = ReturnType<typeof useModalManager>

const ModalContext = createContext<ModalContextValue | null>(null)

export const ModalProvider = ({ children }: PropsWithChildren) => {
  const modalManager = useModalManager()

  return <ModalContext.Provider value={modalManager}>{children}</ModalContext.Provider>
}

export const useModalContext = (): ModalContextValue => {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModalContext must be used within ModalProvider')

  return context
}
