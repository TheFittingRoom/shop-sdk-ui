// Import all components
import {
  ErrorModal,
  FitModal,
  ForgotPasswordModal,
  InitImageSlider,
  InitModalManager,
  LoadingAvatarModal,
  LoggedOutModal,
  ModalManager,
  NoAvatarModal,
  ResetLinkModal,
  ScanCodeModal,
  SignInModal,
  SizeErrorModal,
  TryOnModal,
} from './components'

export { initFittingRoom } from './init'
export type { FittingRoom } from './tfr'

// Export individual components
export {
  ErrorModal,
  FitModal,
  ForgotPasswordModal,
  InitImageSlider,
  InitModalManager,
  LoadingAvatarModal,
  LoggedOutModal,
  ModalManager,
  NoAvatarModal,
  ResetLinkModal,
  ScanCodeModal,
  SignInModal,
  SizeErrorModal,
  TryOnModal,
}

// Export components as a comps object for backward compatibility
export const comps = {
  ErrorModal,
  FitModal,
  ForgotPasswordModal,
  InitImageSlider,
  InitModalManager,
  LoadingAvatarModal,
  LoggedOutModal,
  NoAvatarModal,
  ResetLinkModal,
  ScanCodeModal,
  SignInModal,
  SizeErrorModal,
  TryOnModal,
}
