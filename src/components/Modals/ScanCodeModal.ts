import { ModalContent, ScanCodeModalProps } from '../../types'
import { L } from '../locale'

const ScanCodeModal = (props: ScanCodeModalProps): ModalContent => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  const onSignInNav = () => {
    props.onSignInNav()
  }

  const onCtaClickApple = () => {
    window.open('https://apps.apple.com/us/app/the-fitting-room-3d-body-scan/id1577417373', '_blank')
  }

  const onCtaClickGoogle = () => {
    window.open('https://play.google.com/store/apps/details?id=com.thefittingroom.marketplace', '_blank')
  }

  const onHook = () => {
    document.getElementById('tfr-sign-in-nav')?.addEventListener('click', onSignInNav)
    document.getElementById('tfr-app-store')?.addEventListener('click', onCtaClickApple)
    document.getElementById('tfr-google-play')?.addEventListener('click', onCtaClickGoogle)
  }

  const onUnhook = () => {
    document.getElementById('tfr-sign-in-nav')?.removeEventListener('click', onSignInNav)
    document.getElementById('tfr-app-store')?.removeEventListener('click', onCtaClickApple)
    document.getElementById('tfr-google-play')?.removeEventListener('click', onCtaClickGoogle)
  }

  const renderCtaText = () => (isMobile ? L.ClickHereToDownload : L.ScanQrToDownload)

  const renderImages = () => {
    const base = 'https://assets.dev.thefittingroom.xyz/images/'

    if (isMobile)
      return `
        <img src="${base}apple.png" id="tfr-app-store" />
        <img src="${base}google.png" id="tfr-google-play" />
      `

    return `<img src="${base}qr.png" class="tfr-qr-code" />`
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

        <div tfr-element="true" class="tfr-title-font tfr-light-16-300 tfr-mt-10">${renderCtaText()}</div>

        <div tfr-element="true" class="tfr-flex tfr-space-above">
          ${renderImages()}
        </div>

        <div id="tfr-sign-in-nav" tfr-element="true" class="tfr-body-font tfr-mt-20 tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor">${
          L.HaveAcc
        }</div>
    `
  }

  return {
    Hook: onHook,
    Unhook: onUnhook,
    Body: body,
  }
}

export default ScanCodeModal
