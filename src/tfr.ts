import { FirestoreStyle, initShop } from './api'
/// <reference types="vite/client" />

import { VtoComponent } from './components/VTO'
import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'
import { TFRModal } from './tfr-modal'
import { TFRCssVariables, TFRSizeRec } from './tfr-size-rec'
import * as types from './types'

export interface TFRHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onVtoReady?: (frames: types.TryOnFrames) => void
  onLogin?: () => void
  onLogout?: () => void
}

export class FittingRoom {
  private isLoggedIn: boolean = false
  private isMiddleVtoActive: boolean = false
  private manualListeningOverride: boolean = false

  public style: FirestoreStyle
  public colorwaySizeAsset: types.FirestoreColorwaySizeAsset

  public readonly tfrModal: TFRModal
  public readonly tfrSizeRec: TFRSizeRec
  private readonly vtoComponent: VtoComponent
  private readonly tfrShop: any
  private unsub: () => void = null

  constructor(
    private readonly shopId: string | number,
    modalDivId: string,
    sizeRecMainDivId: string,
    vtoMainDivId: string,
    private readonly hooks: TFRHooks = {},
    cssVariables: TFRCssVariables,
    _env?: string,
  ) {
    // prettier-ignore
    const env = _env
      ? _env
      : import.meta.env.MODE === 'production'
        ? 'prod'
        : 'dev'

    console.log('tfr-env', env)

    this.tfrModal = new TFRModal(
      modalDivId,
      this.signIn.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.tfrShop = initShop(Number(this.shopId), env)
    this.tfrSizeRec = new TFRSizeRec(
      sizeRecMainDivId,
      cssVariables,
      this.tfrShop,
      this.onSignInClick.bind(this),
      this.signOut.bind(this),
      this.onFitInfoClick.bind(this),
      this.onTryOnClick.bind(this),
    )

    if (vtoMainDivId) this.vtoComponent = new VtoComponent(vtoMainDivId)
  }

  get shop() {
    return this.tfrShop
  }

  get sku() {
    return this.tfrSizeRec.sku
  }

  public async setSku(sku: string) {
    console.log('setting sku:', sku)
    this.tfrSizeRec.setSku(sku)

    if (!this.style) {
      console.log('no style cached, fetching for sku:', this.sku)
      this.style = await this.getStyleFromColorwaySizeAssetSku(this.sku)
    } else {
      console.log('style already cached:', this.style)
    }

    if (!this.style) {
      console.error('failed to retrieve style from sku:', sku)
      document.getElementById('tfr-size-recommendations').style.display = 'none'
      return
    }

    if (!this.style.is_published) {
      document.getElementById('tfr-size-recommendations').style.display = 'none'
      console.log(`style ${this.style.id} is not published`)
    } else {
      console.log(`style ${this.style.id} is published`)
    }

    // Check if style supports VTO (assuming all styles support it for now)
    if (this.style.is_vto) {
      document.getElementById('tfr-try-on-button')?.classList.remove('hide')
      console.log(`style ${this.style.id} virtual try on is enabled`)
    }

    if (this.isLoggedIn) {
      this.tfrSizeRec.startSizeRecommendation()
    } else {
      const style = await this.getStyleFromColorwaySizeAssetSku(sku)
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(style)
      this.setStyleMeasurementLocations(styleMeasurementLocations)
    }
  }

  public async onInit() {
    this.isLoggedIn = await this.tfrShop.onInit()
    this.tfrSizeRec.setIsLoggedIn(this.isLoggedIn)

    if (this.isLoggedIn) {
      if (this.hooks?.onLogin) this.hooks.onLogin()

      // Don't auto-subscribe - wait for middle VTO to be displayed
      this.updateFirestoreSubscription()
    } else {
      if (this.hooks?.onLogout) this.hooks.onLogout()

      this.unsubscribeFromProfileChanges()
    }

    return this.isLoggedIn
  }

  public close() {
    this.tfrModal.close()
  }

  public async signOut() {
    await this.tfrShop.user.logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    this.isLoggedIn = false
    this.isMiddleVtoActive = false
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
      await this.tfrShop.user.login(username, password)

      if (this.hooks?.onLogin) this.hooks.onLogin()
      this.tfrModal.close()

      this.isLoggedIn = true
      this.tfrSizeRec.setIsLoggedIn(true)

      // Only start size recommendation if we have a valid style
      if (this.style) {
        this.tfrSizeRec.startSizeRecommendation()
      }
      // Don't auto-subscribe - wait for middle VTO to be displayed
      this.updateFirestoreSubscription()
    } catch (e) {
      return validationError(L.UsernameOrPasswordIncorrect)
    }
  }

  public setBrandUserId(brandUserId: string | number) {
    this.tfrShop.user.setBrandUserId(brandUserId)
  }

  public async submitTel(tel: string) {
    try {
      await this.tfrShop.submitTelephoneNumber(tel)
      this.tfrModal.toSignIn()
    } catch {
      this.tfrModal.onError(L.SomethingWentWrong)
    }
  }

  public async forgotPassword(email: string) {
    await this.tfrShop.user.sendPasswordResetEmail(email)

    this.tfrModal.toSignIn()
  }

  public async passwordReset(code: string, newPassword: string) {
    await this.tfrShop.user.confirmPasswordReset(code, newPassword)

    this.tfrModal.toPasswordReset()
  }

  public async getMeasurementLocationsFromSku(sku: string) {
    return this.tfrShop.getMeasurementLocationsFromSku(sku, [])
  }

  public onSignInClick() {
    this.tfrModal.toScan()
  }

  public onFitInfoClick() {
    this.tfrModal.toFitInfo()
  }

  public async onTryOnClick(sku: string, shouldDisplay: boolean = true) {
    if (!this.vtoComponent)
      return console.error('VtoComponent is not initialized. Please check if the vtoMainDivId is correct.')

    const frames = await this.shop.tryOn(sku)

    if (shouldDisplay) {
      this.isMiddleVtoActive = true
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

  private onUserProfileChange(userProfile: types.FirestoreUser) {
    switch (userProfile.avatar_status as types.AvatarState) {
      case types.AvatarState.NOT_CREATED:
        if (this.hooks?.onError) this.hooks.onError(L.DontHaveAvatar)
        this.tfrModal.onNotCreated()
        break

      case types.AvatarState.PENDING:
        if (this.hooks?.onLoading) this.hooks.onLoading()
        break

      case types.AvatarState.CREATED:
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

    this.unsub = this.tfrShop.user.watchUserProfileForChanges((userProfile) => this.onUserProfileChange(userProfile))
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsub) return

    this.unsub()
    this.unsub = null
  }

  private updateFirestoreSubscription() {
    if (!this.isLoggedIn) return

    const shouldSubscribe = this.isMiddleVtoActive || this.manualListeningOverride

    if (shouldSubscribe && !this.unsub) {
      this.subscribeToProfileChanges()
    } else if (!shouldSubscribe && this.unsub) {
      this.unsubscribeFromProfileChanges()
    }
  }

  public async cacheMeasurementLocations(filledLocations: string[]) {
    const garmentLocations = await this.tfrShop.getMeasurementLocationsFromSku(this.sku, filledLocations)
    this.tfrSizeRec.setStyleMeasurementLocations(garmentLocations)
  }

  public styleToGarmentMeasurementLocations(style: FirestoreStyle) {
    return style.sizes[0].garment_measurements.map((measurement) => measurement.measurement_location)
  }

  public async setStyleMeasurementLocations(measurementLocations: string[]) {
    this.tfrSizeRec.setStyleMeasurementLocations(measurementLocations)
  }

  private async getStyleFromColorwaySizeAssetSku(sku: string): Promise<FirestoreStyle | null> {
    console.log('getting style for sku:', sku)
    try {
      console.log('trying to get colorway size asset for sku:', sku)
      const colorwaySizeAsset = await this.tfrShop.getColorwaySizeAssetFromSku(sku)
      console.log('got colorway size asset:', colorwaySizeAsset)
      console.log('getting style for style_id:', colorwaySizeAsset.style_id)
      const style = await this.tfrShop.GetStyle(colorwaySizeAsset.style_id)
      console.log('got style:', style)

      return style
    } catch (e) {
      console.log('failed to get colorway size asset or style, error:', e)
      return null
    }
  }
}
