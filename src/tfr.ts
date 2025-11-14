import { FirestoreStyle, initShop, TryOnFrames, FirestoreColorwaySizeAsset, FirestoreUser, AvatarState, ParallelInitResult } from './api'
/// <reference types="vite/client" />

import { VtoComponent } from './components/virtualTryOn'
import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'
import { TFRModal } from './components/ModalController'
import { TFRSizeRec as TFRSizeRecommendationController, TFRCssVariables } from './components/SizeRecommendationController'

export interface TFRHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onVtoReady?: (frames: TryOnFrames) => void
  onLogin?: () => void
  onLogout?: () => void
}

export class FittingRoom {
  private isLoggedIn: boolean = false
  private hasInitializedTryOn: boolean = false
  private manualListeningOverride: boolean = false
  private forceFreshVTO: boolean = false
  private _activeSku: string = ''

  public style: FirestoreStyle
  public colorwaySizeAsset: FirestoreColorwaySizeAsset

  public readonly tfrModal: TFRModal
  public readonly tfrSizeRec: TFRSizeRecommendationController
  private readonly vtoComponent: VtoComponent
  private readonly tfrAPI: any
  private unsub: () => void = null

  constructor(
    private readonly shopId: string | number,
    modalDivId: string,
    sizeRecMainDivId: string,
    vtoMainDivId: string,
    private readonly noCacheOnRetry: boolean = false,
    private readonly hooks: TFRHooks = {},
    cssVariables?: TFRCssVariables,
    _env?: string,
  ) {
    // prettier-ignore
    const env = _env
      ? _env
      : import.meta.env.MODE === 'production'
        ? 'prod'
        : 'dev'

    this.tfrModal = new TFRModal(
      modalDivId,
      this.signIn.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.tfrAPI = initShop(Number(this.shopId), env)

    if (vtoMainDivId) this.vtoComponent = new VtoComponent(vtoMainDivId)

    this.tfrSizeRec = new TFRSizeRecommendationController(
      sizeRecMainDivId,
      cssVariables || {},
      this.tfrAPI,
      this.onSignInClick.bind(this),
      this.signOut.bind(this),
      this.onFitInfoClick.bind(this),
      this.onTryOnClick.bind(this),
      this.vtoComponent,
      this.noCacheOnRetry,
    )

    // Register for Firebase auth state changes to handle session restoration
    this.tfrAPI.user.onAuthStateChange((isLoggedIn) => {
      console.debug('Firebase auth state changed to:', isLoggedIn, 'updating UI')
      this.isLoggedIn = isLoggedIn
      this.tfrSizeRec.setIsLoggedIn(isLoggedIn)
    })
  }

  get api() {
    return this.tfrAPI
  }

  get sku() {
    return this._activeSku
  }

  public async onInitParallel(): Promise<ParallelInitResult> {
    const measurementLocationsPromise = this.tfrAPI.getMeasurementLocations()
    const userInitResult = await this.tfrAPI.user.onInit(this.tfrAPI.brandId)

    const initPromise = Promise.all([
      userInitResult.initPromise,
      measurementLocationsPromise,
    ]).then(([isLoggedIn]) => {
      console.debug('initPromise resolved with isLoggedIn:', isLoggedIn)
      return isLoggedIn
    }).catch((error) => {
      console.debug('initPromise rejected:', error)
      return false
    })

    console.debug('Returning init result - isLoggedIn:', userInitResult.isLoggedIn, 'initPromise exists:', !!initPromise)

    this.isLoggedIn = userInitResult.isLoggedIn
    this.tfrSizeRec.setIsLoggedIn(this.isLoggedIn)

    if (this.isLoggedIn) {
      if (this.hooks?.onLogin) this.hooks.onLogin()

      // Don't auto-subscribe - wait for middle VTO to be displayed
      this.updateFirestoreSubscription()
    } else {
      if (this.hooks?.onLogout) this.hooks.onLogout()

      this.unsubscribeFromProfileChanges()
    }

    const result: ParallelInitResult = {
      isLoggedIn: userInitResult.isLoggedIn,
      initPromise,
    }

    return result
  }

  /**
   * Enhanced setSku that can handle preloaded assets or start parallel loading
   */
  public async setSku(activeSku: string, preloadedSkus?: string[], noCache: boolean = false) {
    let assets: Map<string, any>

    let skusToLoad: string[]
    if (preloadedSkus && preloadedSkus.length > 0) {
      const skuSet = new Set([...preloadedSkus, activeSku])
      skusToLoad = Array.from(skuSet)
    } else {
      skusToLoad = [activeSku]
    }

    assets = await this.tfrAPI.FetchAndCacheColorwaySizeAssets(skusToLoad, noCache)

    this._activeSku = activeSku

    if (!this.style) {
      console.debug('fetching style for sku:', this.sku)
      this.style = await this.getStyleFromColorwaySizeAssetSku(this.sku)
    }

    if (!this.style) {
      console.error('failed to retrieve style from sku:', activeSku)
      document.getElementById('tfr-size-recommendations').style.display = 'none'
      return
    }

    if (!this.style.is_published) {
      document.getElementById('tfr-size-recommendations').style.display = 'none'
    }

    if (this.style.is_vto) {
      document.getElementById('tfr-try-on-button')?.classList.remove('hide')
    }

    if (this.isLoggedIn) {
      this.tfrSizeRec.startSizeRecommendation(this.style.id, true)
    } else {
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)
      this.setStyleMeasurementLocations(styleMeasurementLocations)
    }

    return assets
  }

  public close() {
    this.tfrModal.close()
  }

  public async signOut() {
    await this.tfrAPI.user.logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    this.isLoggedIn = false
    this.manualListeningOverride = false
    this.tfrSizeRec.setIsLoggedIn(false)
    this.setStyleMeasurementLocations(this.styleToGarmentMeasurementLocations(this.style))
    this.unsubscribeFromProfileChanges()
  }

  public async signIn(username: string, password: string, validationError: (message: string) => void) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)
    if (!validateEmail(username)) return validationError(L.EmailError)
    if (!validatePassword(password)) return validationError(L.PasswordError)

    try {
      await this.tfrAPI.user.login(username, password)

      if (this.hooks?.onLogin) this.hooks.onLogin()
      this.tfrModal.close()

      this.isLoggedIn = true
      this.tfrSizeRec.setIsLoggedIn(true)

      // Only start size recommendation if we have a valid style
      if (this.style) {
        this.tfrSizeRec.startSizeRecommendation(this.style.id, true)
      }
      // Don't auto-subscribe - wait for middle VTO to be displayed
      this.updateFirestoreSubscription()
    } catch (e) {
      return validationError(L.UsernameOrPasswordIncorrect)
    }
  }

  public setBrandUserId(brandUserId: string | number) {
    this.tfrAPI.user.setBrandUserId(brandUserId)
  }

  public async submitTel(tel: string) {
    try {
      await this.tfrAPI.submitTelephoneNumber(tel)
      this.tfrModal.toSignIn()
    } catch {
      this.tfrModal.onError(L.SomethingWentWrong)
    }
  }

  public async forgotPassword(email: string) {
    await this.tfrAPI.user.sendPasswordResetEmail(email)

    this.tfrModal.toSignIn()
  }

  public async passwordReset(code: string, newPassword: string) {
    await this.tfrAPI.user.confirmPasswordReset(code, newPassword)

    this.tfrModal.toPasswordReset()
  }

  public async getMeasurementLocationsFromSku(sku: string) {
    return this.tfrAPI.getMeasurementLocationsFromSku(sku, [])
  }

  public onSignInClick() {
    this.tfrModal.toScan()
  }

  public onFitInfoClick() {
    this.tfrModal.toFitInfo()
  }

  public async onTryOnClick(sku: string, shouldDisplay: boolean = true, isFromTryOnButton = false) {
    if (isFromTryOnButton) this.hasInitializedTryOn = true
    if (!this.hasInitializedTryOn) {
      return
    }

    if (!this.vtoComponent)
      return console.error('VtoComponent is not initialized. Please check if the vtoMainDivId is correct.')

    this.forceFreshVTO = this.hasInitializedTryOn && this.noCacheOnRetry

    const batchResult = await this.api.tryOnBatch([sku], sku, this.forceFreshVTO)
    const frames = batchResult.get(sku)!

    if (shouldDisplay) {
      this.setManualListeningOverride(true)
      try {
        this.vtoComponent.init()
        this.vtoComponent.onNewFramesReady(frames)
      } catch (e) {
        this.tfrModal.onError(L.SomethingWentWrong)
      }
    }

  }

  public setManualListeningOverride(enabled: boolean) {
    this.manualListeningOverride = enabled
    this.updateFirestoreSubscription()
  }

  private onUserProfileChange(userProfile: FirestoreUser) {
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

  private subscribeToProfileChanges() {
    if (this.unsub) {
      console.debug('Profile changes subscription already active')
      return
    }

    console.debug('Starting continuous user profile monitoring')

    // Use the continuous monitoring method for ongoing updates
    this.unsub = this.tfrAPI.user.watchUserProfileForChangesContinuous(
      (userProfile) => this.onUserProfileChange(userProfile),
      // Optional predicate to filter specific changes if needed
      // For now, we'll get all changes since we want to monitor avatar_status changes
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
    this.tfrSizeRec.setStyleMeasurementLocations(measurementLocations)
  }

  private async getStyleFromColorwaySizeAssetSku(sku: string): Promise<FirestoreStyle | null> {
    try {
      const colorwaySizeAsset = await this.tfrAPI.getColorwaySizeAssetFromSku(sku)
      const style = await this.tfrAPI.GetStyle(colorwaySizeAsset.style_id)
      return style
    } catch (e) {
      return null
    }
  }
}
