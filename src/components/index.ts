import '../styles'
import ErrorModal from './modals/ErrorModal'
import FitModal from './modals/FitModal'
import ForgotPasswordModal from './modals/ForgotPasswordModal'
import LoadingAvatarModal from './modals/LoadingAvatarModal'
import LoggedOutModal from './modals/LoggedOutModal'
import { InitModalManager } from './modals/ModalManager'
import type { ModalManager } from './modals/ModalManager'
import NoAvatarModal from './modals/NoAvatarModal'
import ResetLinkModal from './modals/ResetLinkModal'
import ScanCodeModal from './modals/ScanCodeModal'
import SignInModal from './modals/SignInModal'
import SizeErrorModal from './modals/SizeErrorModal'
import TryOnModal from './modals/TryOnModal'
import { InitImageSlider } from './slider'

export {
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

export type { ModalManager }
export * from './types'
