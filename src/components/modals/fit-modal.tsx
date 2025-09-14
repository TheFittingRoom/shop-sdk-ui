import { Modal } from '@atoms/modal'
import { ModalBody } from '@atoms/modal-body'
import { ModalHeader } from '@atoms/modal-header'

interface FitModalProps {
  isOpen?: boolean
  onClose: () => void
  onSignInNav: () => void
}

const imageBaseUrl = 'https://assets.dev.thefittingroom.xyz/images/'

const tfrDoor = (
  <svg width="26" height="47" viewBox="0 0 68 124" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0.911938 0L67.4819 17.09V106.49L0.911938 123.51V0Z" fill="#209DA7" />
  </svg>
)

export const FitModal = ({ isOpen = true, onClose, onSignInNav }: FitModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Fit Information" className="tfr-modal-fit-info">
      <ModalHeader onClose={onClose} />

      <ModalBody>
        <div>
          <div id="fit-title">Fit Scale</div>

          <div id="fit-line-container">
            <div id="fit-line-text-container">
              <div className="fit-line-item mobile-hidden">Too Tight</div>

              <div className="fit-line-item">
                <div>
                  Tight <span className="light-text">or</span>
                  <br /> More fitted
                </div>

                <div className="desktop-hidden margin-top-10">Too Tight</div>
              </div>

              <div className="fit-line-item fit-line-item-green">
                Slightly tight <br />
                <span className="light-text">or</span> Fitted
              </div>
              <div className="fit-line-item fit-line-item-green">Perfect Fit</div>
              <div className="fit-line-item fit-line-item-green">
                Slightly loose <br />
                <span className="light-text">or</span> Less fitted
              </div>

              <div className="fit-line-item">
                <div>
                  Loose <span className="light-text">or</span>
                  <br /> Not fitted
                </div>

                <div className="desktop-hidden margin-top-10">Oversized</div>
              </div>

              <div className="fit-line-item mobile-hidden">Oversized</div>
            </div>

            <div id="fit-line">
              <div id="fit-line-1" className="mobile-hidden">
                &nbsp;
              </div>
              <div id="fit-line-2">&nbsp;</div>
              <div id="fit-line-3">&nbsp;</div>
              <div id="fit-line-4">&nbsp;</div>
              <div id="fit-line-5">&nbsp;</div>
              <div id="fit-line-6">&nbsp;</div>
              <div id="fit-line-7" className="mobile-hidden">
                &nbsp;
              </div>
            </div>

            <div id="fit-line-texts">
              <div>Poor Fit</div>
              <div>Acceptable Fit</div>
              <div>Poor Fit</div>
            </div>
          </div>

          <div id="fit-subtitle-mobile" className="desktop-hidden">
            Measurement&nbsp;Points
          </div>

          <div id="fit-outline-container">
            <div id="fit-outline-inner-left">
              <div className="fit-outline-line-text fit-outline-line-p-waist-text">Pant&nbsp;Waist</div>
              <div className="fit-outline-line-text fit-outline-line-thigh-text">Thigh</div>
            </div>

            <div id="fit-outline-inner">
              <div className="fit-outline-line fit-outline-line-chest"></div>
              <div className="fit-outline-line fit-outline-line-n-waist"></div>
              <div className="fit-outline-line fit-outline-line-p-waist"></div>
              <div className="fit-outline-line fit-outline-line-h-hip"></div>
              <div className="fit-outline-line fit-outline-line-l-hip"></div>
              <div className="fit-outline-line fit-outline-line-thigh-l"></div>
              <div className="fit-outline-line fit-outline-line-thigh-r"></div>

              <img
                id="tfr-fit-outline-img"
                src={`${imageBaseUrl}fit-outline.png`}
                alt="Body outline showing measurement points"
              />
            </div>

            <div id="fit-outline-inner-right">
              <div id="fit-subtitle" className="mobile-hidden">
                Measurement&nbsp;Points
              </div>

              <div className="fit-outline-line-text fit-outline-line-chest-text">Chest/Bust</div>
              <div className="fit-outline-line-text fit-outline-line-n-waist-text">Natural&nbsp;Waist</div>
              <div className="fit-outline-line-text fit-outline-line-h-hip-text">High&nbsp;Hip</div>
              <div className="fit-outline-line-text fit-outline-line-l-hip-text">Low&nbsp;Hip</div>
            </div>
          </div>
        </div>

        <div id="cta-section">
          <div id="cta-link" onClick={onSignInNav} style={{ cursor: 'pointer' }}>
            Sign Up or Login
          </div>

          <div className="powered-by">
            <div>Powered by</div>
            <div className="tfr-powered-by-logo">{tfrDoor}</div>
            <div className="tfr-powered-by-text-bold">The Fitting Room</div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}
