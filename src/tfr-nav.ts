import * as modals from './components'
import * as types from './types'

export class FittingRoomNav {
  private readonly manager: modals.ModalManager
  private _sku: string

  constructor(
    modalDivId: string,
    private readonly signIn: types.SignInModalProps['onSignIn'],
    private readonly forgotPassword: types.ForgotPasswordModalProps['onPasswordReset'],
  ) {
    this.manager = modals.InitModalManager(modalDivId)
  }

  public get sku(): string {
    return this._sku
  }

  public setSku(sku: string) {
    this._sku = sku
  }

  public close() {
    this.manager.close()
  }

  public onSignIn() {}

  public onSignOut() {
    this.manager.open(
      modals.LoggedOutModal({
        onNavSignIn: () => this.toSignIn(),
        onClose: () => this.close(),
      }),
    )
  }

  public onNotCreated() {
    this.manager.open(modals.NoAvatarModal())
  }

  public onLoading() {
    this.manager.open(
      modals.LoadingAvatarModal({
        timeoutMS: 10000,
      }),
    )
  }

  public toScan() {
    this.manager.open(
      modals.ScanCodeModal({
        onSignInNav: () => this.toSignIn(),
      }),
    )
  }

  public toSignIn() {
    this.manager.open(
      modals.SignInModal({
        onSignIn: this.signIn,
        onNavForgotPassword: () => this.toForgotPassword(),
        onNavScanCode: () => this.toScan(),
      }),
    )
  }

  public toForgotPassword() {
    this.manager.open(
      modals.ForgotPasswordModal({
        onNavSignIn: () => this.toSignIn(),
        onPasswordReset: this.forgotPassword,
      }),
    )
  }

  public toPasswordReset() {}

  public onTryOn(frames: types.TryOnFrames) {
    this.manager.open(
      modals.TryOnModal({
        frames,
        onClose: () => this.close(),
        onNavBack: () => this.navBack(),
      }),
    )
  }

  public onError(error: string) {
    this.manager.open(
      modals.ErrorModal({
        error,
        onClose: () => this.close(),
        onNavBack: () => this.navBack(),
      }),
    )
  }

  public onSizeError(recommended: string, available: string[]) {
    this.manager.open(
      modals.SizeErrorModal({
        sizes: { recommended, available },
        onClose: () => this.close(),
        onNavBack: () => this.navBack(),
      }),
    )
  }

  public navBack() {
    window.history.back()
  }
}
