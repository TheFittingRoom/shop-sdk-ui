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
        <div tfr-element="true">
          <div tfr-element="true" class="tfr-title-font tfr-light-16-300 tfr-mt-10">${L.ModalText}</div>
        </div>
        <div tfr-element="true" class="tfr-logo-box">
          <video id="tfr-video" controls autoplay loop>
            <source src="https://assets.dev.thefittingroom.xyz/videos/the-fitting-room.mp4" />
          </video>
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
