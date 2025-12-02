import { FirestoreColorwaySizeAsset, FirestoreStyle, FirestoreUser, TryOnFrames } from './api'
import { FittingRoomAPI } from './api/api'
import { AvatarStatus, AvatarStatusCreated, AvatarStatusNotCreated, AvatarStatusPending } from './api/gen/enums'
import { GarmentMeasurement } from './api/gen/responses'
import { Config } from './api/helpers/config'
import { UserNotLoggedInError } from './api/helpers/errors'
import { FirebaseAuthUserController } from './api/helpers/firebase/FirebaseAuthUserController'
import { FirestoreUserController } from './api/helpers/firebase/FirestoreUserController'
import { FirestoreController } from './api/helpers/firebase/firestore'
import { TFRModal } from './components/ModalController'
import { SizeRecommendationController, TFRCssVariables } from './components/SizeRecommendationController'
/// <reference types="vite/client" />

import { VTOController } from './components/VirtualTryOnController'
import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'

export interface TFRHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onVtoReady?: (frames: TryOnFrames) => void
  onLogin?: () => void
  onLogout?: () => void
}

export class FittingRoomController {
  private hasInitializedTryOn: boolean = false
  private forceFreshVTO: boolean = false

  public style: FirestoreStyle
  public colorwaySizeAsset: FirestoreColorwaySizeAsset
  private config: Config

  public readonly tfrModal: TFRModal
  public readonly SizeRecommendationController: SizeRecommendationController
  private readonly vtoComponent: VTOController
  private readonly firestoreController: FirestoreController
  private firebaseAuthUserController: FirebaseAuthUserController
  private firestoreUserController: FirestoreUserController
  private readonly API: FittingRoomAPI
  private unsubFirestoreUserCollection: () => void = null

  constructor(
    env: string,
    private readonly shopID: number,
    private readonly styleSKU: string,
    private readonly noCacheOnRetry: boolean = false,
    modalDivId: string,
    sizeRecMainDivId: string,
    vtoMainDivId: string,
    cssVariables?: TFRCssVariables,
    private readonly hooks: TFRHooks = {},
  ) {
    const modalDiv = document.getElementById(modalDivId) as HTMLDivElement
    const sizeRecMainDiv = document.getElementById(sizeRecMainDivId) as HTMLDivElement
    const vtoMainDiv = document.getElementById(vtoMainDivId) as HTMLDivElement
    if (!modalDiv || !sizeRecMainDiv || !vtoMainDiv) {
      console.error(modalDiv, sizeRecMainDiv, vtoMainDiv)
      throw new Error('The Fitting Room essential div id is missing')
    }

    this.config = new Config(env)

    this.tfrModal = new TFRModal(
      modalDiv,
      this.signInClickModalCallback.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.firestoreController = new FirestoreController(this.config)
    this.firebaseAuthUserController = new FirebaseAuthUserController(this.firestoreController.firestore.app)
    this.API = new FittingRoomAPI(this.shopID, this.config, this.firestoreController)

    if (vtoMainDivId) this.vtoComponent = new VTOController(vtoMainDiv)

    this.SizeRecommendationController = new SizeRecommendationController(
      sizeRecMainDiv,
      cssVariables || {},
      this.API,
      this.onSignInSizeRecommendationCallback.bind(this),
      this.onLogOutCallback.bind(this),
      this.onFitInfoCallback.bind(this),
      this.onTryOnCallback.bind(this),
    )
  }

  public async Init(): Promise<void> {
    console.debug('init')
    try {
      const measurementLocationsPromise = this.API.FetchCacheMeasurementLocations()
      const authUserPromise = this.firebaseAuthUserController.GetUserOrNotLoggedIn()
      const stylePromise = this.API.GetStyleByBrandStyleID(this.styleSKU)
      await Promise.all([authUserPromise, stylePromise, measurementLocationsPromise])
      console.debug('promise all ready')

      let cacheColorwaySizeAssetsPromise: Promise<void> = null
      const style = await stylePromise
      if (!style) {
        const errorMsg = L.StyleNotFound
        if (this.hooks?.onError) this.hooks.onError(errorMsg)
        throw new Error(errorMsg)
      }
      this.style = style
      cacheColorwaySizeAssetsPromise = this.API.FetchColorwaySizeAssetsFromStyleId(style.id)

      console.debug('is_published', this.style.is_published)
      if (!this.style.is_published) {
        this.SizeRecommendationController.Hide()
      }

      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)

      const authUser = await authUserPromise
      if (authUser) {
        //init and prefetch user
        this.firestoreUserController = new FirestoreUserController(
          this.firestoreController,
          this.firebaseAuthUserController,
        )
      }

      if (cacheColorwaySizeAssetsPromise) {
        // let cache finish before loading
        await cacheColorwaySizeAssetsPromise
      }

      if (Boolean(authUser)) {
        this.SizeRecommendationController.ShowLoggedIn()
        this.SizeRecommendationController.Show()
        if (this.hooks?.onLogin) this.hooks.onLogin()
        // For logged-in users, start the size recommendation UI
        console.debug('calling startsizerecommendation from init method for logged in user')
        this.SizeRecommendationController.GetSizeRecommendationByStyleID(this.style.id)
      } else {
        console.debug('calling setloggedoutstylemeasurementlocations from init method')
        this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(styleMeasurementLocations)
      }
    } catch (e) {
      console.debug('init caught error:', e)
      if (e instanceof UserNotLoggedInError) {
        console.debug('no user logged in during init')
        return
      }
      const errorMsg = e.message || 'initialization failed'
      if (this.hooks?.onError) this.hooks.onError(errorMsg)
      throw e
    }
  }

  private selectedColorwaySizeAsset: FirestoreColorwaySizeAsset

  // TODO: review this logic
  public async SetColorwaySizeAssetBySKU(activeSku: string, skipCache: boolean = false) {
    console.debug('SetColorwaySizeAssetBySKU', activeSku, skipCache)

    if (!this.style?.is_vto) {
      console.warn('skipping SetColorwaySizeAssetBySKU due to disabled vto')
      return
    }

    try {
      // colorways are already cached at this point or something is wrong
      this.selectedColorwaySizeAsset = await this.API.GetCachedColorwaySizeAssetFromSku(activeSku, skipCache)
    } catch (e) {
      this.SizeRecommendationController.Hide()
      throw e
    }

    this.SizeRecommendationController.ShowTryOnButton()
  }

  public close() {
    this.tfrModal.close()
  }

  public async onLogOutCallback() {
    await this.firebaseAuthUserController.Logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    console.log('calling setLoggedOutStyleMeasurementLocations from logOutCallback')
    this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(
      this.styleToGarmentMeasurementLocations(this.style),
    )
    this.unsubscribeFromProfileChanges()
  }

  public async signInClickModalCallback(
    username: string,
    password: string,
    validationError: (message: string) => void,
  ) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)
    if (!validateEmail(username)) return validationError(L.EmailError)
    if (!validatePassword(password)) return validationError(L.PasswordError)

    try {
      await this.firebaseAuthUserController.Login(username, password)

      // Initialize FirestoreUserController if not already done
      if (!this.firestoreUserController) {
        this.firestoreUserController = new FirestoreUserController(
          this.firestoreController,
          this.firebaseAuthUserController,
        )
      }

      await this.firestoreUserController.WriteUserLogging(this.shopID)

      this.tfrModal.close()
      if (this.hooks?.onLogin) this.hooks.onLogin()

      if (this.style) {
        console.log('calling StartSizeRecommendation after successful login')
        this.SizeRecommendationController.GetSizeRecommendationByStyleID(this.style.id)
      }

      const user = await this.firestoreUserController.GetUser(false)
      this.updateAvatarStatus(user)

      this.firestoreUserController.WatchFirestoreUserChange(this.avatarStatusChangeCallback)
    } catch (e) {
      return validationError(L.UsernameOrPasswordIncorrect)
    }
  }

  public async submitTel(tel: string) {
    try {
      await this.API.SubmitTelephoneNumber(tel)
      this.tfrModal.toSignIn()
    } catch {
      this.tfrModal.onError(L.SomethingWentWrong)
    }
  }

  public async forgotPassword(email: string) {
    await this.firebaseAuthUserController.SendPasswordResetEmail(email)

    this.tfrModal.toSignIn()
  }

  public async passwordReset(code: string, newPassword: string) {
    await this.firebaseAuthUserController.ConfirmPasswordReset(code, newPassword)

    this.tfrModal.toPasswordReset()
  }

  public async getMeasurementLocations(skipCache: boolean) {
    const user = await this.firestoreUserController.GetUser(skipCache)
    return this.API.GetMeasurementLocations(user)
  }

  public onSignInSizeRecommendationCallback() {
    this.tfrModal.toScan()
  }

  public onFitInfoCallback() {
    this.tfrModal.toFitInfo()
  }

  // callback for SizeRecommendationController
  public async onTryOnCallback(selectedSizeID: number, availableSizeIDs: number[], fromSizeRecSelect: boolean) {
    try {
      if (!this.selectedColorwaySizeAsset) {
        throw new Error('selectedColorwaySizeAsset is not set')
      }
      this.SizeRecommendationController.SetVTOLoading(true)

      console.log('tryOncallback', selectedSizeID, availableSizeIDs)
      this.forceFreshVTO = !fromSizeRecSelect && this.hasInitializedTryOn && this.noCacheOnRetry

      const allCachedAssets = this.API.GetCachedColorwaySizeAssets()
      const selectedAsset = allCachedAssets.find(
        (asset) => asset.size_id === selectedSizeID && asset.colorway_id === this.selectedColorwaySizeAsset.colorway_id,
      )
      if (!selectedAsset) {
        throw new Error('selected asset not found in cache')
      }
      const selectedColorwaySizeAssetSKU = selectedAsset.sku
      const availableAssets = allCachedAssets.filter(
        (asset) =>
          availableSizeIDs.includes(asset.size_id) && asset.colorway_id === this.selectedColorwaySizeAsset.colorway_id,
      )
      const availableColorwaySizeAssetSKUs = availableAssets.map((asset) => asset.sku)

      const batchResult = await this.API.PriorityTryOnWithMultiRequestCache(
        this.firestoreUserController,
        selectedColorwaySizeAssetSKU,
        availableColorwaySizeAssetSKUs,
        this.forceFreshVTO,
      )
      this.vtoComponent.onNewFramesReady(batchResult)
      this.SizeRecommendationController.SetVTOLoading(false)
      this.hasInitializedTryOn = true
    } catch (e) {
      this.tfrModal.onError(L.SomethingWentWrong)
      console.log('calling HideVTOLoading after VTO error')
      this.SizeRecommendationController.SetVTOLoading(false)
      console.error(e)
    }
  }

  // if the avatar state loaded from the initial new FirestoreUserController is NOT_CREATED use this listener
  private async avatarStatusChangeCallback(user: FirestoreUser): Promise<boolean> {
    console.debug('onAvatarStateChange', user.avatar_status)
    switch (user.avatar_status as AvatarStatus) {
      case AvatarStatusNotCreated:
        this.updateAvatarStatus(user)
        return false

      case AvatarStatusPending:
        this.updateAvatarStatus(user)
        return false

      case AvatarStatusCreated:
        this.updateAvatarStatus(user)
        return false

      default:
        // if (this.hooks?.onError) this.hooks.onError(L.SomethingWentWrong)
        return true
    }
  }

  private updateAvatarStatus(userProfile: FirestoreUser) {
    switch (userProfile.avatar_status as AvatarStatus) {
      case AvatarStatusNotCreated:
        this.tfrModal.onNotCreated()
        break
      case AvatarStatusPending:
        if (this.hooks?.onLoading) this.hooks.onLoading()
        console.log('calling DisableTryOnButton - avatar not ready')
        this.SizeRecommendationController.HideTryOnButton('Your avatar is not ready yet')
        break
      case AvatarStatusCreated:
        if (this.hooks?.onLoadingComplete) this.hooks.onLoadingComplete()
        console.log('calling EnableTryOnButton - avatar ready')
        this.SizeRecommendationController.EnableTryOnButton()
        break
      default:
        console.log('calling DisableTryOnButton - fitting room unavailable')
        this.SizeRecommendationController.HideTryOnButton('The Fitting Room is currently unavailable.')
        throw new Error('no avatar status')
    }
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsubFirestoreUserCollection) return

    this.unsubFirestoreUserCollection()
    this.unsubFirestoreUserCollection = null
  }

  public styleToGarmentMeasurementLocations(style: FirestoreStyle): GarmentMeasurement[] {
    return style.sizes[0].garment_measurements
  }
}
