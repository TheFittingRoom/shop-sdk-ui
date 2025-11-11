import { ModalContent, SizeErrorModalProps } from '../../types'
import { L } from '../locale'

const SizeErrorModal = (props: SizeErrorModalProps): ModalContent => {
  const onNavBack = () => {
    props.onNavBack()
  }

  const onClose = () => {
    props.onClose()
  }

  const Hook = () => {
    document.getElementById('tfr-back')?.addEventListener('click', onNavBack)
    document.getElementById('tfr-close')?.addEventListener('click', onClose)
  }

  const Unhook = () => {
    document.getElementById('tfr-back')?.removeEventListener('click', onNavBack)
    document.getElementById('tfr-close')?.removeEventListener('click', onClose)
  }

  const Body = () => {
    console.debug('rendering size error modal', props)
    return `
        <div class="tfr-mt-15-p tfr-mb-13-p">
            <div tfr-element="true" class="tfr-title-font tfr-light-22-300 tfr-c-black">
							${L.NoSizeAvailable} ${props.sizes?.recommended} ${L.OrSize} ${props.sizes?.available?.join(' or ')}
						</div>
        </div>

        <div class="tfr-t-a-center">
            <span id="tfr-back" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20">${
              L.ReturnToCatalogPage || 'Return to Catalog Page'
            }</span>
            <span id="tfr-close" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor">${
              L.ReturnToProductPage || 'Return to Product Page'
            }</span>
        </div>
        `
  }

  return {
    Hook,
    Unhook,
    Body,
    useFullModalContent: true,
  }
}

export default SizeErrorModal
