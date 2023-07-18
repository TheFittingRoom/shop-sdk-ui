import { LoadingAvatarModalProps, ModalContent } from '../../types'
import { L } from '../locale'

const LoadingAvatarModal = (props: LoadingAvatarModalProps): ModalContent => {
  function startProgressBar(milliseconds, progressBar) {
    let percentCount = 0
    const millisecondStep = milliseconds / 200
    progressBar.style.width = percentCount + '%'
    const id = setInterval(() => {
      if (percentCount >= 100) {
        clearInterval(id)
      } else {
        percentCount += 0.5
        progressBar.style.width = percentCount + '%'
      }
    }, millisecondStep)
  }

  const Hook = () => {
    const progressBar = document.querySelector('.progress-bar-fill')
    startProgressBar(props.timeoutMS, progressBar)
  }

  const Unhook = () => void 0

  const Body = () => {
    return `
        <div tfr-element="true" class="tfr-title-font tfr-light-22-300 tfr-c-dark tfr-mt-60" > ${L.LoadingAvatar} </div>
        <div class="progress-bar">
            <span class="progress-bar-fill"></span>
        </div>
        `
  }

  return {
    Hook,
    Unhook,
    Body,
  }
}

export default LoadingAvatarModal
