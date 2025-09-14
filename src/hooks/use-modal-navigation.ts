import { ErrorModal } from '@components/modals/error-modal'
import { FitModal } from '@components/modals/fit-modal'
import { ForgotPasswordModal } from '@components/modals/forgot-password-modal'
import { LoadingAvatarModal } from '@components/modals/loading-avatar-modal'
import { LoggedOutModal } from '@components/modals/logged-out-modal'
import { NoAvatarModal } from '@components/modals/no-avatar-modal'
import { ResetLinkModal } from '@components/modals/reset-link-modal'
import { ScanCodeModal } from '@components/modals/scan-code-modal'
import { SignInModal } from '@components/modals/sign-in-modal'
import { SizeErrorModal } from '@components/modals/size-error-modal'
import { TryOnModal } from '@components/modals/try-on-modal'
import type { ModalContextValue } from '@contexts/modal-context'
import type { AuthActions } from './use-auth'

export interface ModalNavigation {
  toSignIn: (email?: string) => void
  toForgotPassword: (email?: string) => void
  toScanCode: () => void
  toResetLink: (email?: string) => void
  showLoggedOut: () => void
  showNoAvatar: () => void
  showLoading: (timeoutMS?: number) => void
  showError: (error: string) => void
  showSizeError: (recommended: string, available: string[]) => void
  showTryOn: (frames: string[]) => void
  showFitInfo: () => void
  close: () => void
  navBack: () => void
}

export const useModalNavigation = (
  modalManagerRef: { current: ModalContextValue | null },
  auth: AuthActions,
): ModalNavigation => {
  const modalState = {
    signIn: { email: '', password: '', error: '', isSubmitting: false },
    forgotPassword: { email: '', error: '', isSubmitting: false },
    scanCode: { tel: '', error: '' },
  }

  const navigation: ModalNavigation = {
    toSignIn: (email?: string) => {
      const modalManager = modalManagerRef.current
      if (!modalManager) {
        console.error('Modal manager not available')
        return
      }

      modalState.signIn.email = email || ''
      modalState.signIn.password = ''
      modalState.signIn.error = ''
      modalState.signIn.isSubmitting = false

      const handleSignIn = async (email: string, password: string) => {
        modalState.signIn.isSubmitting = true
        modalState.signIn.error = ''

        try {
          const success = await auth.signIn(email, password)
          if (success) {
            modalManagerRef.current?.closeModal()
          } else {
            modalState.signIn.error = 'Invalid email or password'

            navigation.toSignIn(email)
          }
        } catch (_err) {
          modalState.signIn.error = 'Sign in failed. Please try again.'
          navigation.toSignIn(email)
        }
      }

      const node = SignInModal({
        isOpen: true,
        emailValue: modalState.signIn.email,
        passwordValue: modalState.signIn.password,
        validationError: modalState.signIn.error,
        isSubmitting: modalState.signIn.isSubmitting,
        onClose: () => modalManagerRef.current?.closeModal(),
        onEmailChange: (value: string) => {
          modalState.signIn.email = value
        },
        onPasswordChange: (value: string) => {
          modalState.signIn.password = value
        },
        onSignIn: handleSignIn,
        onNavForgotPassword: () => navigation.toForgotPassword(modalState.signIn.email),
        onNavScanCode: () => navigation.toScanCode(),
      })

      modalManagerRef.current?.openModal(node)
    },

    toForgotPassword: (email?: string) => {
      modalState.forgotPassword.email = email || ''
      modalState.forgotPassword.error = ''
      modalState.forgotPassword.isSubmitting = false

      const handlePasswordReset = async (email: string) => {
        modalState.forgotPassword.isSubmitting = true
        modalState.forgotPassword.error = ''

        try {
          await auth.sendPasswordReset(email)
          navigation.toResetLink(email)
        } catch (_err) {
          modalState.forgotPassword.error = 'Failed to send reset email. Please try again.'
          modalState.forgotPassword.isSubmitting = false
          navigation.toForgotPassword(email)
        }
      }

      modalManagerRef.current?.openModal(
        ForgotPasswordModal({
          isOpen: true,
          emailValue: modalState.forgotPassword.email,
          isSubmitting: modalState.forgotPassword.isSubmitting,
          validationError: modalState.forgotPassword.error,
          onClose: () => modalManagerRef.current?.closeModal(),
          onEmailChange: (value: string) => {
            modalState.forgotPassword.email = value
          },
          onPasswordReset: handlePasswordReset,
          onNavSignIn: () => navigation.toSignIn(modalState.forgotPassword.email),
          onNavScanCode: () => navigation.toScanCode(),
        }),
      )
    },

    toScanCode: () => {
      modalState.scanCode.tel = ''
      modalState.scanCode.error = ''

      const handleTelSubmit = async (tel: string) => {
        console.log('Phone submitted:', tel)

        modalManagerRef.current?.closeModal()
      }

      modalManagerRef.current?.openModal(
        ScanCodeModal({
          isOpen: true,
          tel: modalState.scanCode.tel,
          error: modalState.scanCode.error,
          onClose: () => modalManagerRef.current?.closeModal(),
          onTelChange: (value: string) => {
            modalState.scanCode.tel = value
          },
          onTelSubmit: handleTelSubmit,
          onSignInNav: () => navigation.toSignIn(),
        }),
      )
    },

    toResetLink: (email?: string) => {
      modalManagerRef.current?.openModal(
        ResetLinkModal({
          isOpen: true,
          email: email || '',
          onClose: () => modalManagerRef.current?.closeModal(),
          onNavSignIn: () => navigation.toSignIn(),
        }),
      )
    },

    showLoggedOut: () => {
      modalManagerRef.current?.openModal(
        LoggedOutModal({
          isOpen: true,
          onClose: () => modalManagerRef.current?.closeModal(),
          onNavSignIn: () => navigation.toSignIn(),
        }),
      )
    },

    showNoAvatar: () => {
      modalManagerRef.current?.openModal(
        NoAvatarModal({
          isOpen: true,
          onClose: () => modalManagerRef.current?.closeModal(),
        }),
      )
    },

    showLoading: (timeoutMS?: number) => {
      modalManagerRef.current?.openModal(
        LoadingAvatarModal({
          isOpen: true,
          timeoutMS,
          onClose: () => modalManagerRef.current?.closeModal(),
        }),
      )
    },

    showError: (error: string) => {
      modalManagerRef.current?.openModal(
        ErrorModal({
          isOpen: true,
          message: error,
          onClose: () => modalManagerRef.current?.closeModal(),
          onRetry: undefined,
        }),
      )
    },

    showSizeError: (_recommended: string, _available: string[]) => {
      modalManagerRef.current?.openModal(
        SizeErrorModal({
          isOpen: true,
          onClose: () => modalManagerRef.current?.closeModal(),
          onNavBack: () => navigation.navBack(),
        }),
      )
    },

    showTryOn: (frames: string[]) => {
      modalManagerRef.current?.openModal(
        TryOnModal({
          isOpen: true,
          frames,
          onClose: () => modalManagerRef.current?.closeModal(),
          onNavBack: () => navigation.navBack(),
        }),
      )
    },

    showFitInfo: () => {
      modalManagerRef.current?.openModal(
        FitModal({
          isOpen: true,
          onClose: () => modalManagerRef.current?.closeModal(),
          onSignInNav: () => navigation.toScanCode(),
        }),
      )
    },

    close: () => {
      modalManagerRef.current?.closeModal()
    },

    navBack: () => {
      window.history.back()
    },
  }

  return navigation
}
