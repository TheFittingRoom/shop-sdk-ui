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
  private activeSku: string = ''

  public style: FirestoreStyle
  public colorwaySizeAsset: FirestoreColorwaySizeAsset
  private config: Config

  public readonly tfrModal: TFRModal
  public readonly tfrSizeRecommendationController: SizeRecommendationController
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
      this.SignIn.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.firestoreController = new FirestoreController(this.config)
    this.firebaseAuthUserController = new FirebaseAuthUserController(this.firestoreController.firestore.app)
    this.API = new FittingRoomAPI(this.shopID, this.config, this.firestoreController)

    if (vtoMainDivId) this.vtoComponent = new VTOController(vtoMainDiv)

    this.tfrSizeRecommendationController = new SizeRecommendationController(
      sizeRecMainDiv,
      cssVariables || {},
      this.API,
      this.onSignInClick.bind(this),
      this.LogOut.bind(this),
      this.onFitInfoClick.bind(this),
      this.onTryOnClick.bind(this),
    )

    // fetch measurement locations and user
    this.init()

    // TODO: write a callback function that gets passed to the API state handlerss
    // this.API.onAuthStateChange((isLoggedIn) => {
    //   console.debug('Firebase auth state changed to:', isLoggedIn, 'updating UI')
    //   this.isLoggedIn = isLoggedIn
    //   this.tfrSizeRecommendationController.setIsLoggedIn(isLoggedIn)
    // })
  }

  get sku() {
    return this.activeSku
  }

  private async init(): Promise<void> {
    const measurementLocationsPromise = this.API.FetchCacheMeasurementLocations()
    const authUser = this.firebaseAuthUserController.GetUserOrNotLoggedIn()
    const user = this.firestoreUserController.FetchUser(false)
    const stylePromise = this.API.GetStyleByBrandStyleID(this.styleSKU)
    const promiseResults = await Promise.all([
      authUser,
      stylePromise,
      measurementLocationsPromise,
    ]).catch(e => {
      console.error("a promise in tfr init failed", e)
      throw e
    })
    if (promiseResults[1]) {
      console.debug('style successfully retrieved via style sku')
      const style = (promiseResults[1] as FirestoreStyle)
      this.style = style
      this.API.FetchColorwaySizeAssetsFromStyleId(style.id)
    }

    this.tfrSizeRecommendationController.setIsLoggedIn(Boolean(authUser))

    if (Boolean(authUser)) {
      if (this.hooks?.onLogin) this.hooks.onLogin()
      // subscribe to firestore
    }
  }

  public async InitSizeRecommendationWithSku(activeSku: string, skipCache: boolean = false) {
    if (!this.style) {
      console.debug('fetching style for sku:', this.sku)
      let colorwaySizeAsset = await this.API.GetCachedColorwaySizeAssetFromSku(activeSku, skipCache)
      this.style = await this.API.GetStyleByID(colorwaySizeAsset.style_id)
    }

    if (!this.style) {
      document.getElementById('tfr-size-recommendations').style.display = 'none'
    }

    if (!this.style.is_published) {
      document.getElementById('tfr-size-recommendations').style.display = 'none'
    }

    if (this.style.is_vto) {
      document.getElementById('tfr-try-on-button')?.classList.remove('hide')
    }

    try {
      await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
      this.tfrSizeRecommendationController.startSizeRecommendation(this.style.id, this.API.GetCachedColorwaySizeAssets())
    } catch (e) {
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)
      this.setStyleMeasurementLocations(styleMeasurementLocations)
    }
  }

  public close() {
    this.tfrModal.close()
  }

  public async LogOut() {
    await this.firebaseAuthUserController.Logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    this.tfrSizeRecommendationController.setIsLoggedIn(false)
    this.setStyleMeasurementLocations(this.styleToGarmentMeasurementLocations(this.style))
    this.unsubscribeFromProfileChanges()
  }

  public async SignIn(username: string, password: string, validationError: (message: string) => void) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)
    if (!validateEmail(username)) return validationError(L.EmailError)
    if (!validatePassword(password)) return validationError(L.PasswordError)

    try {
      await this.firebaseAuthUserController.Login(username, password)

      if (this.hooks?.onLogin) this.hooks.onLogin()
      this.tfrModal.close()

      this.tfrSizeRecommendationController.setIsLoggedIn(true)

      if (this.style) {
        this.tfrSizeRecommendationController.startSizeRecommendation(this.style.id, this.API.GetCachedColorwaySizeAssets())
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

  public onSignInClick() {
    this.tfrModal.toScan()
  }

  public onFitInfoClick() {
    this.tfrModal.toFitInfo()
  }

  // callback for SizeRecommendationController
  public async onTryOnClick(primarySKU: string, availableSKUs: string[]) {
    this.forceFreshVTO = this.hasInitializedTryOn && this.noCacheOnRetry

    const batchResult = await this.API.PriorityTryOnWithMultiRequestCache(this.firestoreUserController, primarySKU, availableSKUs, this.forceFreshVTO)

    try {
      this.vtoComponent.onNewFramesReady(batchResult)
    } catch (e) {
      this.tfrModal.onError(L.SomethingWentWrong)
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
    await this.firestoreUserController.WatchUserProfileForChanges(callback)
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsubFirestoreUserCollection) return

    this.unsubFirestoreUserCollection()
    this.unsubFirestoreUserCollection = null
  }

  public styleToGarmentMeasurementLocations(style: FirestoreStyle) {
    return style.sizes[0].garment_measurements.map((measurement) => measurement.measurement_location)
  }

  public async setStyleMeasurementLocations(measurementLocations: string[]) {
    this.tfrSizeRecommendationController.setStyleMeasurementLocations(measurementLocations)
  }
}
