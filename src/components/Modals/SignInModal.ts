import { ModalContent, SignInModalProps } from '../../types'
import { L } from '../locale'

const SignInModal = (props: SignInModalProps): ModalContent => {
  const { email } = props

  const onSignIn = () => {
    const email = (<HTMLInputElement>document.getElementById('email-input')).value
    const password = (<HTMLInputElement>document.getElementById('password-input')).value
    resetValidation()
    props.onSignIn(email, password, validationError)
  }

  const onNavForgotPassword = () => {
    const email = (<HTMLInputElement>document.getElementById('email-input')).value
    props.onNavForgotPassword(email)
  }

  const onNavScanCode = () => {
    props.onNavScanCode()
  }

  const onHook = () => {
    document.getElementById('tfr-sign-in').addEventListener('click', onSignIn)
    document.getElementById('tfr-forgot-password').addEventListener('click', onNavForgotPassword)
    document.getElementById('tfr-scan-code').addEventListener('click', onNavScanCode)
  }

  const onUnhook = () => {
    document.getElementById('tfr-sign-in').removeEventListener('click', onSignIn)
    document.getElementById('tfr-forgot-password').removeEventListener('click', onNavForgotPassword)
    document.getElementById('tfr-scan-code').removeEventListener('click', onNavScanCode)
  }

  const resetValidation = () => {
    const fieldsetElement = document.querySelectorAll('.tfr-fieldset-element')
    fieldsetElement.forEach((element) => {
      element.classList.remove('tfr-fieldset-err')
    })

    const labelElement = document.querySelectorAll('.tfr-label-element')
    labelElement.forEach((element) => {
      element.classList.remove('tfr-c-red')
    })

    const formError = document.querySelector('#tfr-form-error')
    formError.classList.remove('tfr-d-block')
    formError.innerHTML = ''
  }

  const validationError = (message: string) => {
    const fieldsetElement = document.querySelectorAll('.tfr-fieldset-element')
    fieldsetElement.forEach((element) => {
      element.classList.add('tfr-fieldset-err')
    })

    const labelElement = document.querySelectorAll('.tfr-label-element')
    labelElement.forEach((element) => {
      element.classList.add('tfr-c-red')
    })

    const formError = document.querySelector('#tfr-form-error')
    formError.innerHTML = message || 'Something went wrong'
    formError.classList.add('tfr-d-block')
  }

  const body = () => {
    return `
            <div class="tfr-title-font tfr-light-22-300 tfr-mt-10">${L.SignIn}</div>

            <fieldset class="tfr-fieldset-element tfr-fieldset tfr-mt-20">
                <legend tfr-element="true" class="tfr-label-element tfr-body-font tfr-14-default tfr-c-dark-o5">${
                  L.EmailAddress
                }</legend>
                <input tfr-element="true" type="email" id="email-input" value="${email || ''}" />
            </fieldset>

            <fieldset class="tfr-fieldset-element tfr-fieldset tfr-mt-20">
                <legend tfr-element="true" class="tfr-label-element tfr-body-font tfr-14-default tfr-c-dark-o5">${
                  L.Password
                }</legend>
                <input tfr-element="true" type="password" id="password-input" />
            </fieldset>

            <div tfr-element="true" class="tfr-body-font tfr-12-default tfr-c-red tfr-mt-10 tfr-d-none" id="tfr-form-error"></div>

            <div class="tfr-mt-20">
                <span id="tfr-forgot-password" tfr-element="true" class="tfr-body-font tfr-14-default tfr-c-dark-o5 tfr-underline tfr-cursor tfr-mr-15">${
                  L.ForgotPasswordWithSymbol
                }</span>
                <span id="tfr-scan-code" tfr-element="true" class="tfr-body-font tfr-14-default tfr-c-dark-o5 tfr-underline tfr-cursor">${
                  L.DontHaveAcc
                }</span>
            </div>

            <button id="tfr-sign-in" tfr-element="true" class="tfr-standard-button tfr-bg-aquamarina-strong tfr-c-whitetfr-title-font tfr-medium-16-default tfr-cursor tfr-mt-30" id="sign-in-button">
                ${L.SignIn}
            </button>
            `
  }

  return {
    Hook: onHook,
    Unhook: onUnhook,
    Body: body,
  }
}
export default SignInModal
