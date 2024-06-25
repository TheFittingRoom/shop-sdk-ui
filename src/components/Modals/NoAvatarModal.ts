import { ModalContent } from '../../types'
import { L } from '../locale'

const NoAvatarModal = (): ModalContent => {
  const Hook = () => void 0
  const Unhook = () => void 0
  const Body = () => {
    return `
        <div tfr-element="true" class="tfr-title-font tfr-light-22-300 tfr-c-black tfr-mt-60">${L.DontHaveAvatar}</div>
        <div tfr-element="true" class="tfr-title-font tfr-light-22-300 tfr-c-black tfr-mb-60">${L.ReturnToTfr}</div>
    `
  }

  return {
    Body,
    Hook,
    Unhook,
  }
}

export default NoAvatarModal
