import { type AuthActions, type AuthState, useAuth } from '@hooks/use-auth'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

export type AuthContextValue = AuthState & AuthActions

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: preact.JSX.Element }) => {
  const auth = useAuth()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuthContext must be used within AuthProvider')

  return context
}
