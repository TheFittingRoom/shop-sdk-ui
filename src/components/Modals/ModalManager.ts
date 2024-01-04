import { ModalContent } from '../../types'
import { L } from '../locale'

interface ModalManager {
  open(content: ModalContent): void
  close(): void
  Content(): ModalContent
}

const InitModalManager = (elementID: string): ModalManager => {
  const modal = document.getElementById(elementID)
  if (!modal) {
    throw new Error(`element with id ${elementID} not found`)
  }

  let previousContent: ModalContent

  const renderBody = (modalBody: string) => {
    return `
        <div class="tfr-modal" id="tfr-modal-background">
            <div class="tfr-modal-content-container tfr-p-20">
                <div class="tfr-close-container">
                    <span id="tfr-close-container" class="tfr-close tfr-cursor">&times;</span>
                </div>

                <div class="tfr-modal-content-flex">
                  <div class="tfr-modal-content tfr-pt-20 tfr-pb-50">
                      <div class="tfr-modal-title-logo-container">
                          <div tfr-element="true" class="trf-logo-title tfr-title-font tfr-light-24-300 tfr-c-dark tfr-mr-10">${L.VirtualTryOnWith}</div>
                          <div tfr-element="true" class="tfr-logo-container">
                            <div class="tfr-mr-15">
                              <svg width="26" height="47" viewBox="0 0 68 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0.911938 0L67.4819 17.09V106.49L0.911938 123.51V0Z" fill="#209DA7">
                                </path>
                                <path d="M52.8019 64.44C54.7791 64.44 56.3819 62.4387 56.3819 59.97C56.3819 57.5013 54.7791 55.5 52.8019 55.5C50.8248 55.5 49.2219 57.5013 49.2219 59.97C49.2219 62.4387 50.8248 64.44 52.8019 64.44Z" fill="white">
                                </path>
                              </svg>
                            </div>
                            <div tfr-element="true" class="tfr-title-font tfr-light-24-500 tfr-c-dark tfr-mr-10">${L.TheFittingRoom}</div>
                          </div>
                      </div>
                      ${modalBody}
                  </div>
                </div>
            </div>
        </div>
    `
  }

  const Open = (content: ModalContent) => {
    if (previousContent) {
      previousContent.Unhook()
    }
    modal.innerHTML = renderBody(content.Body())
    hook()
    content.Hook()
    modal.style.display = 'block'
    previousContent = content
  }

  const Close = () => {
    if (previousContent) {
      previousContent.Unhook()
      unhook()
    }
    modal.style.display = 'none'
  }

  const EscClose = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      Close()
    }
  }

  const ContainerClose = (e: MouseEvent) => {
    const background = modal.querySelector('#tfr-modal-background')
    if (e.target === background) {
      console.debug('container close')
      Close()
    }
  }

  const hook = () => {
    modal.querySelector('#tfr-close-container').addEventListener('click', Close)
    document.addEventListener('keydown', EscClose)
    document.addEventListener('click', ContainerClose)
  }

  const unhook = () => {
    const closeLink = modal.querySelector('#tfr-close-container')
    if (closeLink) {
      closeLink.removeEventListener('click', Close)
    } else {
      console.error('#tfr-close-container not found on unhook')
      console.debug(document.getElementById(elementID)?.innerHTML)
    }
    document.removeEventListener('keydown', EscClose)
    document.removeEventListener('click', ContainerClose)
  }

  const Content = () => {
    return previousContent
  }

  return {
    open: Open,
    close: Close,
    Content,
  }
}

export { InitModalManager, ModalManager }
