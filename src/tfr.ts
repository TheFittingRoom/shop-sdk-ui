import { Errors, TfrShop, initShop } from '@thefittingroom/sdk'

import { L } from './components/locale'
import { FittingRoomNav } from './tfr-nav'
import * as types from './types'

export interface TfrHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onAvatarReady?: (frames: types.TryOnFrames) => void
}

export class FittingRoom {
  public readonly nav: FittingRoomNav
  private readonly tfrShop: TfrShop

  constructor(private readonly shopId: string | number, modalDivId: string, private readonly hooks: TfrHooks = {}) {
    this.nav = new FittingRoomNav(modalDivId, this.signIn.bind(this), this.forgotPassword.bind(this))
    this.tfrShop = initShop(Number(this.shopId))
  }

  get sku() {
    return this.nav.sku
  }

  get shop() {
    return this.tfrShop
  }

  public onInit() {
    return this.tfrShop.onInit()
  }

  public setSku(sku: string) {
    this.nav.setSku(sku)
  }

  public close() {
    this.nav.close()
  }

  public async signOut() {
    await this.tfrShop.user.logout()
    this.nav.toSignIn()
  }

  public async signIn(username: string, password: string, validationError: (message: string) => void) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)

    await this.tfrShop.user.login(username, password)

    try {
      const userProfile = await this.tfrShop.user.getUserProfile()

      switch (userProfile.avatar_status as types.AvatarState) {
        case types.AvatarState.NOT_CREATED:
          this.nav.onNotCreated()
          break

        case types.AvatarState.PENDING:
          this.nav.onLoading()
          break

        case types.AvatarState.CREATED:
          console.debug('avatar_state: created')
          this.tryOn()
          break

        default:
          this.nav.onError(L.SomethingWentWrong)
          break
      }
    } catch {
      this.nav.onError(L.SomethingWentWrong)
    }
  }

  public async forgotPassword(email: string) {
    await this.tfrShop.user.sendPasswordResetEmail(email)

    this.nav.toForgotPassword()
  }

  public async passwordReset(code: string, newPassword: string) {
    await this.tfrShop.user.confirmPasswordReset(code, newPassword)

    this.nav.toPasswordReset()
  }

  public async tryOn() {
    try {
      if (this.hooks.onLoading) this.hooks.onLoading()
      this.nav.onLoading()

      const frames = await this.tfrShop.tryOn(this.sku)

      this.nav.close()
      if (this.hooks.onAvatarReady) this.hooks.onAvatarReady(frames)
    } catch (error) {
      if (error instanceof Errors.RecommendedAvailableSizesError)
        return this.nav.onSizeError(error.recommended_size, error.available_sizes)

      if (error instanceof Errors.UserNotLoggedInError) return this.nav.toScan()

      console.error(error.message)
      this.nav.onError(L.SomethingWentWrong)
    } finally {
      if (this.hooks.onLoadingComplete) this.hooks.onLoadingComplete()
    }
  }
}
