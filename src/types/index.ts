import { FirebaseUser, TfrShop } from '@thefittingroom/sdk'

import { ModalManager } from '../components'
import { UIError } from '../components/uiError'
import * as types from '../types'

export const TfrLogo = process.env.ASSETS_URL + '/tfr-logo.svg'
export const AposeLogo = process.env.ASSETS_URL + '/apose-logo.svg'
export const AppStoreLogo = process.env.ASSETS_URL + '/app-store-logo.svg'
export const QrCodeLogo = process.env.ASSETS_URL + '/qr-code-logo.svg'

export const NotLoggedIn = new Error('user not logged in')
export const NoFramesFound = new Error('No frames found for this colorway')
export const NoColorwaySizeAssetsFound = new Error('No colorway size assets found')
export const NoStylesFound = new Error('No styles found')

export interface RecommendedAvailableSizes {
  error: string
  recommended_size: string
  available_sizes: string[]
}

export interface FittingRoom {
  shop: TfrShop
  manager: ModalManager
  onSignout(colorwaySizeAssetSKU: string): () => Promise<void>
  onClose(): void
  onNavBack(): void
  onTryOn(colorwaySizeAssetSKU: string): void
  whenAvatarNotCreated(colorwaySizeAssetSKU: string): void
  whenAvatarPending(colorwaySizeAssetSKU: string): void
  whenAvatarCreated(colorwaySizeAssetSKU: string): void
  whenNotSignedIn(colorwaySizeAssetSKU: string): void

  whenTryOnReady(colorwaySizeAssetSKU: string, frames: types.TryOnFrames): void

  whenTryOnLoading(colorwaySizeAssetSKU: string): void

  whenTryOnFailed(colorwaySizeAssetSKU: string, error: Error): void

  whenError(colorwaySizeAssetSKU: string, error: UIError): void
  whenSignedIn(user: FirebaseUser, colorwaySizeAssetSKU: string): void
  whenSignedOut(colorwaySizeAssetSKU: string): void

  onSignIn(
    colorwaySizeAssetSKU: string,
  ): (username: string, password: string, validation: (message: string) => void) => void
  onNavSignIn(colorwaySizeAssetSKU: string): (email: string) => void
  onPasswordReset(colorwaySizeAssetSKU: string): (email: string) => void
  onNavForgotPassword(colorwaySizeAssetSKU: string): (email: string) => void
  onNavScanCode(colorwaySizeAssetSKU: string): void
  TryOn(colorwaySizeAssetSKU: string): void
}

export interface ModalContent {
  Body: () => string
  Hook(): void
  Unhook(): void
}

export interface ModalProps {}

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

export type TryOnFrames = string[]

export enum AvatarState {
  NOT_CREATED = 'NOT_CREATED',
  CREATED = 'CREATED',
  PENDING = 'PENDING',
}

export type FirestoreColorwaySizeAsset = {
  id: number
  size_id: number
  style_id: number
  colorway_id: number
  colorway_name: string
  sku: string
}

export type FirestoreGarmentMeasurement = {
  id: number
  garment_measurement_location: string
  tolerance: number
  value: number
}

export type FirestoreSize = {
  id: number
  size: string
  label: string
  size_system: string
  size_value_id: string
  garment_measurements: Map<string, FirestoreGarmentMeasurement>
}

export type FirestoreColorway = {
  id: number
  name: string
}

export type FirestoreStyle = {
  id: number
  brand_id: number
  brand_style_id: string
  name: string
  description: string
  garment_category: string
  is_published: boolean
  sale_type: string
  colorways: { [key: number]: FirestoreColorway }
  sizes: { [key: number]: FirestoreSize }
}
