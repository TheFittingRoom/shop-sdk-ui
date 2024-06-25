import { ForgotPasswordModalProps, ModalContent } from '../../types'
import { L } from '../locale'

const ForgotPasswordModal = (props: ForgotPasswordModalProps): ModalContent => {
  const onNavSignIn = () => {
    const email = (<HTMLInputElement>document.getElementById('tfr-email')).value
    props.onNavSignIn(email)
  }

  const onPasswordReset = () => {
    const email = (<HTMLInputElement>document.getElementById('tfr-email')).value
    props.onPasswordReset(email)
  }

  const Hook = () => {
    document.getElementById('tfr-send-password-reset').addEventListener('click', onPasswordReset)
    document.getElementById('tfr-back-to-signin').addEventListener('click', onNavSignIn)
  }

  const Unhook = () => {
    document.getElementById('tfr-send-password-reset').removeEventListener('click', onPasswordReset)
    document.getElementById('tfr-back-to-signin').removeEventListener('click', onNavSignIn)
  }

  const Body = () => {
    return `
        <div tfr-element="true" class="tfr-title-font tfr-light-16-300 tfr-mt-20 tfr-w-70-p tfr-m-h-auto">${L.EnterEmailAddress}</div>
        <fieldset class="tfr-fieldset-element tfr-fieldset tfr-mt-30">
            <legend tfr-element="true" class="tfr-label-element tfr-body-font tfr-14-default tfr-c-black-o5">${L.EmailAddress}</legend>
            <input tfr-element="true" type="email" id="tfr-email" />
        </fieldset>
        <div tfr-element="true" class="tfr-body-font tfr-12-default tfr-c-red tfr-mt-10 tfr-d-none" id="error-msg"></div>
        <div id="tfr-back-to-signin" tfr-element="true" class="tfr-body-font tfr-12-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mt-30">${L.BackToSignIn}</div>
        <button id="tfr-send-password-reset" tfr-element="true" class="tfr-standard-button tfr-c-brand-bg tfr-c-whitetfr-title-font tfr-medium-16-default tfr-cursor tfr-mt-30">
            ${L.Send}
        </button>
    `
  }

  return {
    Hook,
    Unhook,
    Body,
  }
}

export default ForgotPasswordModal
