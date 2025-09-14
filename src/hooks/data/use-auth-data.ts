import { useTfrShopContext } from '@contexts/tfr-shop-context'
import {
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { FirestoreUser } from '@thefittingroom/sdk/dist/esm/types'
import { useEffect } from 'preact/hooks'
import { queryKeys } from './query-keys'

export interface AuthStatus {
  isLoggedIn: boolean
  userId?: string
}

export interface LoginVariables {
  username: string
  password: string
}

export interface UserProfile {
  id: string
  email: string
  firstName?: string
  lastName?: string
  measurements?: Record<string, number>
  preferences?: Record<string, any>
}

export const useAuthStatus = (
  options?: Omit<UseQueryOptions<AuthStatus>, 'queryKey' | 'queryFn'>,
): UseQueryResult<AuthStatus> => {
  const tfrShop = useTfrShopContext()

  return useQuery({
    queryKey: queryKeys.auth.status(),
    queryFn: async () => {
      const isLoggedIn = await tfrShop.onInit()
      return {
        isLoggedIn,
        userId: isLoggedIn ? tfrShop.user?.id : undefined,
      }
    },
    ...options,
  })
}

export const useUserProfile = (): UseQueryResult<UserProfile | null> => {
  const tfrShop = useTfrShopContext()
  const { data: authStatus } = useAuthStatus()

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: async () => {
      if (!authStatus?.isLoggedIn) return null

      const profile = await tfrShop.user.getUserProfile()
      if (!profile) return null

      return {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        measurements: profile.measurements,
        preferences: profile.preferences,
      }
    },
    enabled: !!authStatus?.isLoggedIn,
  })
}

export const useLogin = (): UseMutationResult<boolean, Error, LoginVariables> => {
  const tfrShop = useTfrShopContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ username, password }) => {
      await tfrShop.user.login(username, password)
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all })
    },
    onError: (error) => {
      console.error('Login failed:', error)
    },
  })
}

export const useLogout = () => {
  const tfrShop = useTfrShopContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await tfrShop.user.logout()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all })
      queryClient.removeQueries({ queryKey: queryKeys.user.all })
    },
    onError: (error) => {
      console.error('Logout failed:', error)
    },
  })
}

export const usePasswordReset = () => {
  const tfrShop = useTfrShopContext()

  return useMutation({
    mutationFn: async (email: string) => {
      await tfrShop.user.sendPasswordResetEmail(email)
    },
    onError: (error) => {
      console.error('Password reset failed:', error)
    },
  })
}

export const useUserProfileSubscription = (
  onProfileChange: (profile: FirestoreUser | null) => void,
  deps?: readonly any[],
): void => {
  const tfrShop = useTfrShopContext()
  const queryClient = useQueryClient()
  const { data: authStatus } = useAuthStatus()

  useEffect(() => {
    if (!authStatus?.isLoggedIn) return undefined

    const unsubscribe = tfrShop.user.watchUserProfileForChanges((profile) => {
      if (profile) {
        queryClient.setQueryData(queryKeys.user.profile(), profile)
        onProfileChange(profile)
      } else {
        queryClient.setQueryData(queryKeys.user.profile(), null)
        onProfileChange(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, deps || [authStatus?.isLoggedIn])
}
