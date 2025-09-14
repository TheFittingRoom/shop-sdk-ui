import { L } from '@locale'

import type { LoadingAvatarModalProps } from '@types'
import { useEffect, useRef } from 'preact/hooks'

export const LoadingAvatarModal = ({ isOpen = true, timeoutMS, onClose: _ }: LoadingAvatarModalProps) => {
  const progressBarRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!isOpen || !progressBarRef.current) return null

    const progressBar = progressBarRef.current
    let percentCount = 0
    const millisecondStep = timeoutMS / 200
    progressBar.style.width = `${percentCount}%`

    const id = setInterval(() => {
      if (percentCount >= 100) {
        clearInterval(id)
      } else {
        percentCount += 0.5
        progressBar.style.width = `${percentCount}%`
      }
    }, millisecondStep)

    return () => clearInterval(id)
  }, [isOpen, timeoutMS])

  if (!isOpen) return null

  return (
    <div className="tfr-modal tfr-modal-full">
      <div className="tfr-modal-content">
        <div tfr-element="true" className="tfr-title-font tfr-light-22-300 tfr-c-black tfr-mt-60">
          {L.LoadingAvatar}
        </div>
        <div className="progress-bar">
          <span className="progress-bar-fill" ref={progressBarRef}></span>
        </div>
      </div>
    </div>
  )
}
