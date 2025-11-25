import { FirestoreStyle, TryOnFrames, FirestoreColorwaySizeAsset, FirestoreUser, AvatarState } from './api'
/// <reference types="vite/client" />

import { VTOController } from './components/VirtualTryOnController'
import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'
import { TFRModal } from './components/ModalController'
import { SizeRecommendationController, TFRCssVariables } from './components/SizeRecommendationController'
import { FittingRoomAPI } from './api/api'
import { Config } from './api/helpers/config'
import { FirebaseAuthUserController } from './api/helpers/firebase/FirebaseAuthUserController'
import { FirestoreUserController } from './api/helpers/firebase/FirestoreUserController'
import { DocumentData } from 'firebase/firestore'
import { FirestoreController } from './api/helpers/firebase/firestore'
import { UserNotLoggedInError } from './api/helpers/errors'

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
      throw new Error(
        'The Fitting Room essential div id is missing',
      )
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
      this.signInSizeRecommendationCallback.bind(this),
      this.logOutCallback.bind(this),
      this.fitInfoCallback.bind(this),
      this.tryOnCallback.bind(this),
    )

    // TODO: write a callback function that gets passed to the API state handlerss
    // this.API.onAuthStateChange((isLoggedIn) => {
    //   console.debug('Firebase auth state changed to:', isLoggedIn, 'updating UI')
    //   this.isLoggedIn = isLoggedIn
    //   this.tfrSizeRecommendationController.setIsLoggedIn(isLoggedIn)
    // })
  }

  public async Init(): Promise<void> {
    try {
      const measurementLocationsPromise = this.API.FetchCacheMeasurementLocations()
      const authUserPromise = this.firebaseAuthUserController.GetUserOrNotLoggedIn()
      const stylePromise = this.API.GetStyleByBrandStyleID(this.styleSKU)
      await Promise.all([
        authUserPromise,
        stylePromise,
        measurementLocationsPromise,
      ])

      let cacheColorwaySizeAssetsPromise: Promise<void> = null
      const style = await stylePromise
      if (style) {
        this.style = style
        cacheColorwaySizeAssetsPromise = this.API.FetchColorwaySizeAssetsFromStyleId(style.id)
      }
      const authUser = await authUserPromise
      if (authUser) {
        //init and prefetch user
        this.firestoreUserController = new FirestoreUserController(
          this.firestoreController,
          this.firebaseAuthUserController)

        // Log the user login for returning users
        await this.firestoreUserController.LogUserLogin(this.shopID)
      }

      if (cacheColorwaySizeAssetsPromise) {
        // let cache finish before loading
        await cacheColorwaySizeAssetsPromise
      }

      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)
      this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(styleMeasurementLocations)

      if (Boolean(authUser)) {
        if (this.hooks?.onLogin) this.hooks.onLogin()
        // subscribe to firestore
      }
    } catch (e) {
      if (e instanceof UserNotLoggedInError) {
        console.debug("No user logged in during init")
        return
      }
      throw e
    }
  }

  public async InitSizeRecommendationWithSku(activeSku: string, skipCache: boolean = false) {
    console.debug("InitSizeRecommendationWithSku", activeSku, skipCache)
    if (!this.style) {
      console.debug('fetching style for sku:', activeSku)
      let colorwaySizeAsset = await this.API.GetCachedColorwaySizeAssetFromSku(activeSku, skipCache)
      this.style = await this.API.GetStyleByID(colorwaySizeAsset.style_id)
    }

    if (!this.style) {
      this.SizeRecommendationController.Hide()
    }

    if (!this.style.is_published) {
      this.SizeRecommendationController.Hide()
    }

    if (this.style.is_vto) {
      this.SizeRecommendationController.ShowTryOnButton()
    }

    try {
      await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
      this.SizeRecommendationController.StartSizeRecommendation(this.style.id, this.API.GetCachedColorwaySizeAssets())
    } catch (e) {
      if (!(e instanceof UserNotLoggedInError)) {
        throw e
      }
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)
      this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(styleMeasurementLocations)
    }
  }

  public close() {
    this.tfrModal.close()
  }

  public async logOutCallback() {
    await this.firebaseAuthUserController.Logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(this.styleToGarmentMeasurementLocations(this.style))
    this.unsubscribeFromProfileChanges()
  }

  public async signInClickModalCallback(username: string, password: string, validationError: (message: string) => void) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)
    if (!validateEmail(username)) return validationError(L.EmailError)
    if (!validatePassword(password)) return validationError(L.PasswordError)

    try {
      await this.firebaseAuthUserController.Login(username, password)

      // Initialize FirestoreUserController if not already done
      if (!this.firestoreUserController) {
        this.firestoreUserController = new FirestoreUserController(
          this.firestoreController,
          this.firebaseAuthUserController)
      }

      // Log the user login
      await this.firestoreUserController.LogUserLogin(this.shopID)

      if (this.hooks?.onLogin) this.hooks.onLogin()
      this.tfrModal.close()

      if (this.style) {
        this.SizeRecommendationController.StartSizeRecommendation(this.style.id, this.API.GetCachedColorwaySizeAssets())
      }
      // TODO manage firestore subscription state
      // update logged in user
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

  public async getMeasurementLocationsFromSku(sku: string, skipCache: boolean) {
    return this.API.GetMeasurementLocationsFromSku(sku, [], skipCache)
  }

  public signInSizeRecommendationCallback() {
    this.tfrModal.toScan()
  }

  public fitInfoCallback() {
    this.tfrModal.toFitInfo()
  }

  // callback for SizeRecommendationController
  public async tryOnCallback(primarySKU: string, availableSKUs: string[]) {
    console.log("tryOncallback", primarySKU, availableSKUs)
    this.forceFreshVTO = this.hasInitializedTryOn && this.noCacheOnRetry

    try {
      const batchResult = await this.API.PriorityTryOnWithMultiRequestCache(this.firestoreUserController, primarySKU, availableSKUs, this.forceFreshVTO)
      this.vtoComponent.onNewFramesReady(batchResult)
      this.SizeRecommendationController.HideVTOLoading()
      this.hasInitializedTryOn = true
    } catch (e) {
      this.tfrModal.onError(L.SomethingWentWrong)
      this.SizeRecommendationController.HideVTOLoading()
      console.error(e)
    }
  }

  private onAvatarStateChange(userProfile: FirestoreUser) {
    console.debug('onUserProfileChange called with avatar_status:', userProfile.avatar_status)

    switch (userProfile.avatar_status as AvatarState) {
      case AvatarState.NOT_CREATED:
        console.debug('Avatar not created - showing error modal')
        if (this.hooks?.onError) this.hooks.onError(L.DontHaveAvatar)
        this.tfrModal.onNotCreated()
        break

      case AvatarState.PENDING:
        console.debug('Avatar pending - showing loading')
        if (this.hooks?.onLoading) this.hooks.onLoading()
        break

      case AvatarState.CREATED:
        console.debug('Avatar created - loading complete')
        if (this.hooks?.onLoadingComplete) this.hooks.onLoadingComplete()
        break

      default:
        console.debug('Unknown avatar state:', userProfile.avatar_status)
        if (this.hooks?.onError) this.hooks.onError(L.SomethingWentWrong)
        this.tfrModal.onError(L.SomethingWentWrong)
        break
    }
  }

  private async addStateChangeHandler(callback: (data: DocumentData) => Promise<boolean>): Promise<void> {
    await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
    await this.firestoreUserController.WatchFirestoreUserChange(callback)
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsubFirestoreUserCollection) return

    this.unsubFirestoreUserCollection()
    this.unsubFirestoreUserCollection = null
  }

  public styleToGarmentMeasurementLocations(style: FirestoreStyle) {
    return style.sizes[0].garment_measurements.map((measurement) => measurement.measurement_location)
  }
}
