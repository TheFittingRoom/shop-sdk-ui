import { initTel } from '../../helpers/telephone'
import { ModalContent, ScanCodeModalProps } from '../../types'
import { L } from '../locale'

const ScanCodeModal = (props: ScanCodeModalProps): ModalContent => {
  const onSignInNav = () => {
    props.onSignInNav()
  }

  const onTelSubmit = () => {
    const phone = (<HTMLInputElement>document.getElementById('tel-input')).value
    props.onTelSubmit(phone)
  }

  const onHook = () => {
    initTel('#tel-input')
    document.getElementById('tel-button').addEventListener('click', onTelSubmit)
    document.getElementById('tfr-sign-in-nav').addEventListener('click', onSignInNav)
  }

  const onUnhook = () => {
    document.getElementById('tel-button').removeEventListener('click', onTelSubmit)
    document.getElementById('tfr-sign-in-nav').removeEventListener('click', onSignInNav)
  }

  const body = () => {
    return `
        <div tfr-element="true" class="tfr-logo-box">
          <div class="tfr-mr-15">
            <svg width="26" height="47" viewBox="0 0 68 124" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.911938 0L67.4819 17.09V106.49L0.911938 123.51V0Z" fill="white">
              </path>
              <path d="M52.8019 64.44C54.7791 64.44 56.3819 62.4387 56.3819 59.97C56.3819 57.5013 54.7791 55.5 52.8019 55.5C50.8248 55.5 49.2219 57.5013 49.2219 59.97C49.2219 62.4387 50.8248 64.44 52.8019 64.44Z" fill="#209DA7">
              </path>
            </svg>
          </div>
          <div tfr-element="true" class="tfr-title-font tfr-light-24-300 tfr-mr-10 tfr-c-white">${L.TheFittingRoom}</div>
        </div>

        <div tfr-element="true" class="tfr-title-font tfr-light-16-300 tfr-mt-10">${L.EnterPhoneNumber}</div>

        <div tfr-element="true" class="tfr-flex">
          <fieldset class="tfr-fieldset-element tfr-fieldset-inline tfr-mt-20">
              <legend tfr-element="true" class="tfr-label-element tfr-body-font tfr-14-default tfr-c-dark-o5">${L.PhoneNumber}</legend>
              <div tfr-element="true" class="tfr-flex">
                <input tfr-element="true" type="tel" id="tel-input" />
              </div>
          </fieldset>
          <button tfr-element="true" class="tfr-standard-button tfr-bg-aquamarina-strong tfr-c-whitetfr-title-font tfr-medium-16-default tfr-cursor tfr-mt-30" id="tel-button">
            ${L.Send}
          </button>
        </div>

        <div id="tfr-sign-in-nav" tfr-element="true" class="tfr-body-font tfr-mt-20 tfr-16-default tfr-c-dark-o5 tfr-underline tfr-cursor">${L.HaveAcc}</div>
    `
  }

  return {
    Hook: onHook,
    Unhook: onUnhook,
    Body: body,
  }
}

export default ScanCodeModal
