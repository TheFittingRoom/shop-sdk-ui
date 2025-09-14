import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

interface QueryClientContextValue {
  initialized: boolean
}

const QueryClientContext = createContext<QueryClientContextValue>({ initialized: true })

export const QueryClientProvider = QueryClientContext.Provider

export const useQueryClientContext = (): QueryClientContextValue => {
  const context = useContext(QueryClientContext)
  if (!context) {
    throw new Error('useQueryClientContext must be used within QueryClientProvider')
  }
  return context
}
