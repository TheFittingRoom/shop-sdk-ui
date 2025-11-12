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
    private readonly allowVTORetry: boolean = false,
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
      this.allowVTORetry,
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
    return this.tfrSizeRec.sku
  }

  private async setSkuInternal(sku: string) {
    this.tfrSizeRec.setSku(sku)

    if (!this.style) {
      console.debug('fetching style for sku:', this.sku)
      this.style = await this.getStyleFromColorwaySizeAssetSku(this.sku)
    }

    if (!this.style) {
      console.error('failed to retrieve style from sku:', sku)
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
  }

  public async onInitParallel(skusToPreload?: string[], forceRefresh: boolean = false): Promise<ParallelInitResult> {
    console.debug('FittingRoom.onInitParallel called at:', new Date().toISOString())
    const initResult = await this.tfrAPI.onInitParallel(skusToPreload, forceRefresh)
    console.debug('initResult received - isLoggedIn:', initResult.isLoggedIn)
    console.debug('Before setting isLoggedIn - this.isLoggedIn:', this.isLoggedIn)
    this.isLoggedIn = initResult.isLoggedIn
    console.debug('After setting isLoggedIn - this.isLoggedIn:', this.isLoggedIn)
    console.debug('Calling tfrSizeRec.setIsLoggedIn with:', this.isLoggedIn)
    this.tfrSizeRec.setIsLoggedIn(this.isLoggedIn)

    // Preload the style since all SKUs share the same style_id
    if (initResult.preloadedAssets && initResult.preloadedAssets.size > 0) {
      const firstSku = Array.from(initResult.preloadedAssets.keys())[0]
      const firstAsset = initResult.preloadedAssets.get(firstSku)!
      this.style = await this.tfrAPI.GetStyle(firstAsset.style_id)
    }

    if (this.isLoggedIn) {
      if (this.hooks?.onLogin) this.hooks.onLogin()

      // Don't auto-subscribe - wait for middle VTO to be displayed
      this.updateFirestoreSubscription()
    } else {
      if (this.hooks?.onLogout) this.hooks.onLogout()

      this.unsubscribeFromProfileChanges()
    }

    return initResult
  }

  /**
   * Enhanced setSku that can handle preloaded assets or start parallel loading
   */
  public async setSku(sku: string, preloadedAssets?: Map<string, any>) {
    const asset = await this.tfrAPI.setSkuWithParallel(sku, preloadedAssets)

    // Style is already preloaded in onInitParallel, no need to fetch

    // Continue with normal setSku logic
    await this.setSkuInternal(sku)

    return asset
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
    console.debug('onTryOnClick:', sku, shouldDisplay, isFromTryOnButton, 'hasInitialized:', this.hasInitializedTryOn)
    if (isFromTryOnButton) this.hasInitializedTryOn = true
    if (!this.hasInitializedTryOn) {
      console.debug('skipping try on, not initialized')
      return
    }

    if (!this.vtoComponent)
      return console.error('VtoComponent is not initialized. Please check if the vtoMainDivId is correct.')

    const frames = await this.api.tryOn(sku, this.allowVTORetry)

    if (shouldDisplay) {
      this.updateFirestoreSubscription()
      try {
        this.vtoComponent.init()
        this.vtoComponent.onNewFramesReady(frames)
      } catch (e) {
        console.error('Error initializing VTO:', e)
        this.tfrModal.onError(L.SomethingWentWrong)
      }
    }
  }

  public setManualListeningOverride(enabled: boolean) {
    this.manualListeningOverride = enabled
    this.updateFirestoreSubscription()
  }

  private onUserProfileChange(userProfile: FirestoreUser) {
    switch (userProfile.avatar_status as AvatarState) {
      case AvatarState.NOT_CREATED:
        if (this.hooks?.onError) this.hooks.onError(L.DontHaveAvatar)
        this.tfrModal.onNotCreated()
        break

      case AvatarState.PENDING:
        if (this.hooks?.onLoading) this.hooks.onLoading()
        break

      case AvatarState.CREATED:
        if (this.hooks?.onLoadingComplete) this.hooks.onLoadingComplete()
        break

      default:
        if (this.hooks?.onError) this.hooks.onError(L.SomethingWentWrong)
        this.tfrModal.onError(L.SomethingWentWrong)
        break
    }
  }

  private subscribeToProfileChanges() {
    if (this.unsub) return

    this.unsub = this.tfrAPI.user.watchUserProfileForChanges((userProfile) => this.onUserProfileChange(userProfile))
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsub) return

    this.unsub()
    this.unsub = null
  }

  private updateFirestoreSubscription() {
    if (!this.isLoggedIn) return

    const shouldSubscribe = this.manualListeningOverride

    if (shouldSubscribe && !this.unsub) {
      this.subscribeToProfileChanges()
    } else if (!shouldSubscribe && this.unsub) {
      this.unsubscribeFromProfileChanges()
    }
  }

  public async cacheMeasurementLocations(filledLocations: string[]) {
    const garmentLocations = await this.tfrAPI.getMeasurementLocationsFromSku(this.sku, filledLocations)
    this.tfrSizeRec.setStyleMeasurementLocations(garmentLocations)
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
