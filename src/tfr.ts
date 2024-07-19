import { types as ShopTypes, TfrShop, initShop } from '@thefittingroom/sdk'

import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'
import { TfrModal } from './tfr-modal'
import { TfrCssVariables, TfrSizeRec } from './tfr-size-rec'
import * as types from './types'

export interface TfrHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onVtoReady?: (frames: types.TryOnFrames) => void
  onLogin?: () => void
  onLogout?: () => void
}

export class FittingRoom {
  private isLoggedIn: boolean = false

  public readonly tfrModal: TfrModal
  public readonly tfrSizeRec: TfrSizeRec
  private readonly tfrShop: TfrShop
  private unsub: () => void = null

  constructor(
    private readonly shopId: string | number,
    modalDivId: string,
    sizeRecMainDivId: string,
    private readonly hooks: TfrHooks = {},
    cssVariables: TfrCssVariables,
    _env?: string,
  ) {
    // prettier-ignore
    const env = _env
      ? _env
      : typeof process !== 'undefined'
      ? process.env.NODE_ENV
      : 'dev'

    this.tfrModal = new TfrModal(
      modalDivId,
      this.signIn.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.tfrShop = initShop(Number(this.shopId), env)
    this.tfrSizeRec = new TfrSizeRec(
      sizeRecMainDivId,
      cssVariables,
      this.tfrShop,
      this.onSignInClick.bind(this),
      this.signOut.bind(this),
    )
  }

  get shop() {
    return this.tfrShop
  }

  get sku() {
    return this.tfrSizeRec.sku
  }

  public async checkIfPublished(brandStyleIdOrSku: string) {
    const style = await this.getStyle(brandStyleIdOrSku)

    return Boolean(style?.is_published)
  }

  public setSku(sku: string) {
    this.tfrSizeRec.setSku(sku)

    if (this.isLoggedIn) this.tfrSizeRec.setRecommendedSize()
    else this.setGarmentLocations()
  }

  public async onInit() {
    this.isLoggedIn = await this.tfrShop.onInit()
    this.tfrSizeRec.setIsLoggedIn(this.isLoggedIn)

    if (this.isLoggedIn) {
      if (this.hooks?.onLogin) this.hooks.onLogin()

      this.subscribeToProfileChanges()
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
    this.tfrSizeRec.setIsLoggedIn(false)
    this.setGarmentLocations()
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
      this.tfrSizeRec.setRecommendedSize()
      this.subscribeToProfileChanges()
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
    return this.tfrShop.getMeasurementLocationsFromSku(sku)
  }

  public onSignInClick() {
    this.tfrModal.toScan()
  }

  private onUserProfileChange(userProfile: ShopTypes.FirestoreUser) {
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

  private async setGarmentLocations() {
    const style = await this.getStyle(this.sku)

    const filledLocations =
      style?.sizes?.[0]?.garment_measurements.map((measurement) => measurement.measurement_location) || ([] as string[])

    this.tfrSizeRec.setGarmentLocations(filledLocations)
  }

  private async getStyle(brandStyleIdOrSku: string) {
    try {
      const colorwaySizeAsset = await this.tfrShop.getColorwaySizeAssetFromSku(brandStyleIdOrSku)
      const style = await this.tfrShop.getStyle(colorwaySizeAsset.style_id)

      return style
    } catch {
      try {
        const style = await this.tfrShop.getStyleByBrandStyleId(brandStyleIdOrSku)

        return style
      } catch {
        return null
      }
    }
  }
}
