import { LoggedOutModalProps, ModalContent } from '../../types'
import { L } from '../locale'

const LoggedOutModal = (props: LoggedOutModalProps): ModalContent => {
  const onNavSignIn = () => {
    props.onNavSignIn('')
  }

  const onClose = () => {
    props.onClose()
  }

  const Hook = () => {
    document.getElementById('tfr-sign-in').addEventListener('click', onNavSignIn)
    document.getElementById('tfr-close').addEventListener('click', onClose)
  }

  const Unhook = (): void => {
    document.getElementById('tfr-sign-in').removeEventListener('click', onNavSignIn)
    document.getElementById('tfr-close').removeEventListener('click', onClose)
  }

  const Body = () => {
    return `
        <div tfr-element="true" class="tfr-title-font tfr-light-22-300 tfr-mt-15-p tfr-mb-13-p">${L.SuccessfullyLoggedOut}</div>
        <div class="tfr-t-a-center">
            <span id="tfr-sign-in" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-dark-o5 tfr-underline tfr-cursor tfr-mr-20">${L.SignBackIn}</span>
            <span id="tfr-close" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-dark-o5 tfr-underline tfr-cursor" >${L.ReturnToSite}</span>
        </div>
    `
  }

  return {
    Hook,
    Unhook,
    Body,
  }
}

export default LoggedOutModal
