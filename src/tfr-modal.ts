import * as modals from './components'
import * as types from './types'

export class TfrModal {
  private readonly manager: modals.ModalManager

  constructor(
    modalDivId: string,
    private readonly signIn: types.SignInModalProps['onSignIn'],
    private readonly forgotPassword: types.ForgotPasswordModalProps['onPasswordReset'],
    private readonly submitTel: types.ScanCodeModalProps['onTelSubmit'],
  ) {
    this.manager = modals.InitModalManager(modalDivId)
  }

  public close() {
    this.manager.close()
  }

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
        onTelSubmit: (tel: string) => this.submitTel(tel),
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

  public toFitInfo() {
    this.manager.open(
      modals.FitModal({
        onSignInNav: () => this.toScan(),
        onClose: () => this.close(),
      }),
    )
  }

  public navBack() {
    window.history.back()
  }
}
