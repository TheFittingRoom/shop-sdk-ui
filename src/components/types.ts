/// <reference types="vite/client" />
import { ModalManager } from './modals/ModalManager'
import { UIError } from './uiError'
import { TryOnFrames } from '../api'
import type { FirestoreUser } from '../api/gen/responses'

export interface ModalContent {
    Body: () => string
    Hook(): void
    Unhook(): void
    useFullModalContent: boolean
}

export interface ModalProps { }

export interface SignInParams {
    email: string
    password: string
}

export interface SignInModalProps extends ModalProps {
    email?: string
    onSignIn: (email: string, password: string, validationError: (message: string) => void) => void
    onNavForgotPassword: (email?: string) => void
    onNavScanCode: () => void
}

export interface ForgotPasswordModalProps extends ModalProps {
    email?: string
    onNavSignIn: (email: string) => void
    onPasswordReset: (email: string) => void
}

export type NoAvatarModalProps = ModalProps

export interface LoadingAvatarModalProps extends ModalProps {
    timeoutMS: number
}

export interface TryOnModalProps extends ModalProps {
    frames: TryOnFrames
    onNavBack: () => void
    onClose: () => void
}

export interface ErrorModalProps extends ModalProps {
    error: string
    onNavBack: () => void
    onClose: () => void
}

export interface SizeErrorModalProps {
    onNavBack: () => void
    onClose: () => void
    sizes?: {
        recommended: string
        available: string[]
    }
}

export interface ResetLinkModalProps {
    email: string
    onNavSignIn: (email: string) => void
}

export interface ScanCodeModalProps {
    onSignInNav: () => void
    onTelSubmit: (tel: string) => void
}

export interface LoggedOutModalProps {
    onClose: () => void
    onNavSignIn: (email: string) => void
}

export interface FitModalProps {
    onSignInNav: () => void
    onClose: () => void
}