import { FirestoreStyle, TryOnFrames, FirestoreColorwaySizeAsset, FirestoreUser, AvatarState } from './api'
/// <reference types="vite/client" />

import { VTOController } from './components/VirtualTryOnController'
import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'
import { TFRModal } from './components/ModalController'
import { SizeRecommendationController, TFRCssVariables } from './components/SizeRecommendationController'
import { TFRAPI } from './api/api'
import { User } from 'firebase/auth'

export interface TFRHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onVtoReady?: (frames: TryOnFrames) => void
  onLogin?: () => void
  onLogout?: () => void
}

export class FittingRoomController {
  private isLoggedIn: boolean = false
  private hasInitializedTryOn: boolean = false
  private manualListeningOverride: boolean = false
  private forceFreshVTO: boolean = false
  private activeSku: string = ''

  public style: FirestoreStyle
  public colorwaySizeAsset: FirestoreColorwaySizeAsset

  public readonly tfrModal: TFRModal
  public readonly tfrSizeRecommendationController: SizeRecommendationController
  private readonly vtoComponent: VTOController
  private readonly API: TFRAPI
  private unsub: () => void = null

  constructor(
    public readonly env: string,
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
      console.error(
        'The Fitting Room functionality has been disabled due to missing critical elements or functions. Please resolve the errors above.',
      )
      return
    }

    this.tfrModal = new TFRModal(
      modalDiv,
      this.signIn.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.API = new TFRAPI(this.shopID)

    if (vtoMainDivId) this.vtoComponent = new VTOController(vtoMainDivId)

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

    // Register for Firebase auth state changes to handle session restoration
    this.API.User.onAuthStateChange((isLoggedIn) => {
      console.debug('Firebase auth state changed to:', isLoggedIn, 'updating UI')
      this.isLoggedIn = isLoggedIn
      this.tfrSizeRecommendationController.setIsLoggedIn(isLoggedIn)
    })
  }

  get sku() {
    return this.activeSku
  }

  private async init(): Promise<void> {
    const measurementLocationsPromise = this.API.fetchCacheMeasurementLocations()
    const user = this.API.User.User()
    const stylePromise = this.API.GetStyleByBrandStyleID(this.styleSKU)
    const promiseResults = await Promise.all([
      user,
      stylePromise,
      measurementLocationsPromise,
    ]).catch(e => {
      console.error("a promise in tfr init failed")
      throw e
    })
    if (promiseResults[1]) {
      console.debug('style successfully retrieved via style sku')
      const style = (promiseResults[1] as FirestoreStyle)
      this.style = style
      this.API.FetchCachedColorwaySizeAssetsFromStyleId(style.id, false)
    }

    this.isLoggedIn = Boolean(promiseResults[0])
    this.tfrSizeRecommendationController.setIsLoggedIn(this.isLoggedIn)

    if (this.isLoggedIn) {
      if (this.hooks?.onLogin) this.hooks.onLogin()

      this.updateFirestoreSubscription()
    }
  }

  public async InitSizeRecommendationWithSku(activeSku: string, skipCache: boolean = false) {
    if (!this.style) {
      console.debug('fetching style for sku:', this.sku)
      let colorwaySizeAsset = await this.API.GetColorwaySizeAssetFromSku(activeSku)
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

    if (this.isLoggedIn) {
      this.tfrSizeRecommendationController.startSizeRecommendation(this.style.id, skipCache)
    } else {
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)
      this.setStyleMeasurementLocations(styleMeasurementLocations)
    }
  }

  public close() {
    this.tfrModal.close()
  }

  public async LogOut() {
    await this.API.User.logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    this.isLoggedIn = false
    this.manualListeningOverride = false
    this.tfrSizeRecommendationController.setIsLoggedIn(false)
    this.setStyleMeasurementLocations(this.styleToGarmentMeasurementLocations(this.style))
    this.unsubscribeFromProfileChanges()
  }

  public async signIn(username: string, password: string, validationError: (message: string) => void) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)
    if (!validateEmail(username)) return validationError(L.EmailError)
    if (!validatePassword(password)) return validationError(L.PasswordError)

    try {
      await this.API.User.login(username, password)

      if (this.hooks?.onLogin) this.hooks.onLogin()
      this.tfrModal.close()

      this.isLoggedIn = true
      this.tfrSizeRecommendationController.setIsLoggedIn(true)

      if (this.style) {
        this.tfrSizeRecommendationController.startSizeRecommendation(this.style.id, true)
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
    await this.API.User.sendPasswordResetEmail(email)

    this.tfrModal.toSignIn()
  }

  public async passwordReset(code: string, newPassword: string) {
    await this.API.User.confirmPasswordReset(code, newPassword)

    this.tfrModal.toPasswordReset()
  }

  public async getMeasurementLocationsFromSku(sku: string) {
    return this.API.GetMeasurementLocationsFromSku(sku, [])
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

    const batchResult = await this.API.PriorityTryOnWithMultiRequestCache(primarySKU, availableSKUs, this.forceFreshVTO)

    this.setManualListeningOverride(true)
    try {
      this.vtoComponent.onNewFramesReady(batchResult)
    } catch (e) {
      this.tfrModal.onError(L.SomethingWentWrong)
    }
  }

  public setManualListeningOverride(enabled: boolean) {
    this.manualListeningOverride = enabled
    this.updateFirestoreSubscription()
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

  private async subscribeToProfileChanges() {
    if (this.unsub) {
      console.debug('Profile changes subscription already active')
      return
    }
    const user = await this.API.User.User()
    if (!user) {
      throw new Error("subscribeToProfileChanges called with no user")
    }

    console.debug('Starting continuous user profile monitoring')
    this.unsub = this.API.User.watchUserProfileForChangesContinuous(
      (user as User).uid,
      (userProfile) => this.onAvatarStateChange(userProfile as FirestoreUser),
      undefined
    )
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsub) return

    this.unsub()
    this.unsub = null
  }

  private updateFirestoreSubscription() {
    if (!this.isLoggedIn) return

    const shouldSubscribe = this.manualListeningOverride
    console.debug('updateFirestoreSubscription: isLoggedIn=', this.isLoggedIn, 'manualListeningOverride=', this.manualListeningOverride, 'shouldSubscribe=', shouldSubscribe, 'hasUnsub=', !!this.unsub)

    if (shouldSubscribe && !this.unsub) {
      this.subscribeToProfileChanges()
    } else if (!shouldSubscribe && this.unsub) {
      this.unsubscribeFromProfileChanges()
    }
  }

  public styleToGarmentMeasurementLocations(style: FirestoreStyle) {
    return style.sizes[0].garment_measurements.map((measurement) => measurement.measurement_location)
  }

  public async setStyleMeasurementLocations(measurementLocations: string[]) {
    this.tfrSizeRecommendationController.setStyleMeasurementLocations(measurementLocations)
  }
}
