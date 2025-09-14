import { type SizeRecActions, type SizeRecState, useSizeRec } from '@hooks/use-size-rec'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

export type SizeRecContextValue = SizeRecState & SizeRecActions

const SizeRecContext = createContext<SizeRecContextValue | null>(null)

export const SizeRecProvider = ({ children }: { children: preact.JSX.Element }) => {
  const sizeRec = useSizeRec()

  return <SizeRecContext.Provider value={sizeRec}>{children}</SizeRecContext.Provider>
}

export const useSizeRecContext = (): SizeRecContextValue => {
  const context = useContext(SizeRecContext)
  if (!context) throw new Error('useSizeRecContext must be used within SizeRecProvider')

  return context
}
