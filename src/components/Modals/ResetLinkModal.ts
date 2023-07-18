import { ModalContent, ResetLinkModalProps } from '../../types'
import { L } from '../locale'

const ResetLinkModal = (props: ResetLinkModalProps): ModalContent => {
  const { email } = props

  const onNavSignIn = () => {
    props.onNavSignIn(email || '')
  }

  const Hook = () => {
    document.getElementById('tfr-back-to-signin').addEventListener('click', onNavSignIn)
  }

  const Unhook = () => {
    document.getElementById('tfr-back-to-signin').removeEventListener('click', onNavSignIn)
  }

  const Body = () => {
    return `
    <div tfr-element="true" class="tfr-title-font tfr-light-22-300 tfr-c-dark tfr-mt-15-p tfr-mb-13-p tfr-w-80-p tfr-m-h-auto">${L.AssociatedEmail}</div>
    <div class="tfr-t-a-center">
        <span id="tfr-back-to-signin" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-dark-o5 tfr-underline tfr-cursor tfr-mr-20">${L.BackToSignIn}</span>
    </div>
    `
  }

  return {
    Hook,
    Unhook,
    Body,
  }
}
export default ResetLinkModal
