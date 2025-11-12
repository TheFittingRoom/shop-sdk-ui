import { InitImageSlider } from '../virtualTryOnSlider'
import { ModalContent, TryOnModalProps } from '../types'

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
        `
  }

  return {
    Hook,
    Unhook,
    Body,
    useFullModalContent: true,
  }
}

export default TryOnModal
