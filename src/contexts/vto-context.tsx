import { useVto, type VtoActions, type VtoState } from '@hooks/use-vto'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

export type VtoContextValue = VtoState & VtoActions

const VtoContext = createContext<VtoContextValue | null>(null)

export const VtoProvider = ({ children }: { children: preact.JSX.Element }) => {
  const vto = useVto()

  return <VtoContext.Provider value={vto}>{children}</VtoContext.Provider>
}

export const useVtoContext = (): VtoContextValue => {
  const context = useContext(VtoContext)
  if (!context) throw new Error('useVtoContext must be used within VtoProvider')

  return context
}
