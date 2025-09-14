import { Modal } from '@atoms/modal'
import { ModalBody } from '@atoms/modal-body'
import { ModalHeader } from '@atoms/modal-header'
import { L } from '@components/locale'

import clsx from 'clsx'
import { useEffect, useRef } from 'preact/hooks'
import { Fragment } from 'preact/jsx-runtime'

interface ScanCodeModalProps {
  isOpen: boolean
  tel: string
  error: string
  onClose: () => void
  onTelChange: (value: string) => void
  onTelSubmit: (tel: string) => void
  onSignInNav: () => void
}

export const ScanCodeModal = ({
  isOpen,
  tel: _tel,
  error: _error,
  onClose,
  onTelChange: _onTelChange,
  onTelSubmit: _onTelSubmit,
  onSignInNav,
}: ScanCodeModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const imageBaseUrl = 'https://assets.dev.thefittingroom.xyz/images/'

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(() => null)
    }
  }, [isOpen])

  const handleAppStoreClick = () => {
    window.open('https://apps.apple.com/us/app/the-fitting-room-3d-body-scan/id1577417373', '_blank')
  }

  const handleGooglePlayClick = () => {
    window.open('https://play.google.com/store/apps/details?id=com.thefittingroom.marketplace', '_blank')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Scan Code">
      <ModalHeader onClose={onClose} />

      <ModalBody>
        <div tfr-element="true">
          <div tfr-element="true" className="tfr-title-font tfr-light-16-300 tfr-mt-10">
            {L.ModalText}
          </div>
        </div>

        <div tfr-element="true" className="tfr-logo-box">
          <video
            id="tfr-video"
            ref={videoRef}
            className={clsx({ 'tfr-video-responsive': isMobile })}
            controls
            loop
            autoPlay
            playsInline
            muted
          >
            <source src="https://assets.dev.thefittingroom.xyz/videos/the-fitting-room.mp4" />
          </video>

          {!isMobile && (
            <div id="tfr-qr-border-box">
              <div tfr-element="true" className="tfr-title-font tfr-24-bold">
                {L.ScanQrToDownload}
              </div>

              <img src={`${imageBaseUrl}qr.png`} className="tfr-qr-code" alt="QR Code" />

              <div
                id="tfr-sign-in-nav"
                tfr-element="true"
                className="tfr-body-font tfr-mt-20 tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor"
                style={{ marginBottom: '0' }}
                onClick={(e) => {
                  console.log('[DEBUG] Sign in link clicked!', e)
                  console.log('[DEBUG] onSignInNav:', onSignInNav)
                  onSignInNav()
                }}
              >
                {L.HaveAcc}
              </div>
            </div>
          )}
        </div>

        {isMobile && (
          <Fragment>
            <div tfr-element="true" className="tfr-title-font tfr-light-16-300 tfr-mt-10 tfr-max-w-600">
              {L.ClickHereToDownload}
            </div>

            <div tfr-element="true" className="tfr-flex tfr-space-above">
              <img
                className="tfr-mobile-logo"
                src={`${imageBaseUrl}apple.png`}
                id="tfr-app-store"
                onClick={handleAppStoreClick}
                alt="App Store"
                style={{ cursor: 'pointer' }}
              />
              <img
                className="tfr-mobile-logo"
                src={`${imageBaseUrl}google.png`}
                id="tfr-google-play"
                onClick={handleGooglePlayClick}
                alt="Google Play"
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div
              id="tfr-sign-in-nav"
              tfr-element="true"
              className="tfr-body-font tfr-mt-20 tfr-16-default tfr-c-black-o5 tfr-underline tfr-cursor"
              onClick={(e) => {
                console.log('[DEBUG MOBILE] Sign in link clicked!', e)
                console.log('[DEBUG MOBILE] onSignInNav:', onSignInNav)
                onSignInNav()
              }}
            >
              {L.HaveAcc}
            </div>
          </Fragment>
        )}
      </ModalBody>
    </Modal>
  )
}
