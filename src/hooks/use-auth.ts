import { useAuthStatus, useLogin, useLogout, usePasswordReset, useUserProfile } from './data/use-auth-data'

export interface AuthState {
  isLoggedIn: boolean
  isLoading: boolean
  user: any | null
  error: string | null
}

export interface AuthActions {
  signIn: (username: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  checkLoginStatus: () => Promise<boolean>
}

export const useAuth = (): AuthState & AuthActions => {
  const { data: authStatus, refetch: refetchAuthStatus } = useAuthStatus()
  const { data: userProfile } = useUserProfile()
  const loginMutation = useLogin()
  const logoutMutation = useLogout()
  const passwordResetMutation = usePasswordReset()

  const signIn = async (username: string, password: string): Promise<boolean> => {
    try {
      await loginMutation.mutateAsync({ username, password })
      return true
    } catch {
      return false
    }
  }

  const signOut = async (): Promise<void> => {
    await logoutMutation.mutateAsync()
  }

  const sendPasswordReset = async (email: string): Promise<void> => {
    await passwordResetMutation.mutateAsync(email)
  }

  const checkLoginStatus = async (): Promise<boolean> => {
    const result = await refetchAuthStatus()
    return result.data?.isLoggedIn || false
  }

  const isLoading = loginMutation.isPending || logoutMutation.isPending || passwordResetMutation.isPending

  const error =
    loginMutation.error?.message || logoutMutation.error?.message || passwordResetMutation.error?.message || null

  return {
    isLoggedIn: authStatus?.isLoggedIn || false,
    isLoading,
    user: userProfile,
    error,
    signIn,
    signOut,
    sendPasswordReset,
    checkLoginStatus,
  }
}
