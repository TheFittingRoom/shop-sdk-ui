import { InitImageSlider } from '../../components/slider'
import { ModalContent, TryOnModalProps } from '../../types'
import { L } from '../locale'

const TryOnModal = (props: TryOnModalProps): ModalContent => {
  let close = () => void 0

  const onNavBack = () => {
    props.onNavBack()
  }

  const onClose = () => {
    props.onClose()
  }

  const Hook = () => {
    const tryOnImage = <HTMLImageElement>document.getElementById('tfr-tryon-image')
    const onChange = (slider, imageUrl) => {
      console.debug('slider change', slider, imageUrl)
      tryOnImage.src = imageUrl
    }
    const slider = InitImageSlider('tfr-slider', onChange)
    if (Array.isArray(props.frames) && props.frames.length > 0) {
      const e = slider.Load(props.frames)
      if (e instanceof Error) {
        console.error(e)
        return
      }
      close = e as () => void
    }
    document.getElementById('tfr-back')?.addEventListener('click', onNavBack)
    document.getElementById('tfr-close')?.addEventListener('click', onClose)
  }

  const Unhook = () => {
    close()
    document.getElementById('tfr-back')?.removeEventListener('click', onNavBack)
    document.getElementById('tfr-close')?.removeEventListener('click', onClose)
  }

  const Body = () => {
    return `
        <div class="tfr-slider-wrapper">
				<img id="tfr-tryon-image" src="" />
				<input type="range" id="tfr-slider" />
				</div>
				<div class="tfr-t-a-center">
            <span id="tfr-back" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor tfr-mr-20">${
              L.ReturnToCatalogPage || 'Return to Catalog Page'
            }</span>
            <span id="tfr-close" tfr-element="true" class="tfr-body-font tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor" id="returnToSite">${
              L.ReturnToProductPage || 'Return to Product Page'
            }</span>
        </div>
        `
  }

  return {
    Hook,
    Unhook,
    Body,
  }
}

export default TryOnModal
