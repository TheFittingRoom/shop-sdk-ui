import { FitModalProps, ModalContent } from '../types'
import { tfrDoor } from '../svgs'

const FitModal = (props: FitModalProps): ModalContent => {
  const imageBaseUrl = 'https://assets.dev.thefittingroom.xyz/images/'
  const onSignInNav = () => props.onSignInNav()

  const Hook = () => {
    document.getElementById('cta-link').addEventListener('click', onSignInNav)
  }

  const Unhook = () => {
    document.getElementById('cta-link').removeEventListener('click', onSignInNav)
  }

  const Body = () => {
    return `
      <div>
        <div id="fit-title">Fit Scale</div>

        <div id="fit-line-container">
          <div id="fit-line-text-container">
            <div class="fit-line-item mobile-hidden">Too Tight</div>

            <div class="fit-line-item">
              <div>Tight <span class="light-text">or</span><br /> More fitted</div>

              <div class="desktop-hidden margin-top-10">Too Tight</div>
            </div>

            <div class="fit-line-item fit-line-item-green">Slightly tight <br /><span class="light-text">or</span> Fitted</div>
            <div class="fit-line-item fit-line-item-green">Perfect Fit</div>
            <div class="fit-line-item fit-line-item-green">Slightly loose <br /><span class="light-text">or</span> Less fitted</div>

            <div class="fit-line-item">
              <div>Loose <span class="light-text">or</span><br /> Not fitted</div>

              <div class="desktop-hidden margin-top-10">Oversized</div>
            </div>

            <div class="fit-line-item mobile-hidden">Oversized</div>
          </div>

          <div id="fit-line">
            <div id="fit-line-1" class="mobile-hidden">&nbsp;</div>
            <div id="fit-line-2">&nbsp;</div>
            <div id="fit-line-3">&nbsp;</div>
            <div id="fit-line-4">&nbsp;</div>
            <div id="fit-line-5">&nbsp;</div>
            <div id="fit-line-6">&nbsp;</div>
            <div id="fit-line-7" class="mobile-hidden">&nbsp;</div>
          </div>

          <div id="fit-line-texts">
            <div>Poor Fit</div>
            <div>Acceptable Fit</div>
            <div>Poor Fit</div>
          </div>
        </div>

        <div id="fit-subtitle-mobile" class="desktop-hidden">Measurement&nbsp;Points</div>

        <div id="fit-outline-container">
          <div id="fit-outline-inner-left">
            <div class="fit-outline-line-text fit-outline-line-p-waist-text">Pant&nbsp;Waist</div>
            <div class="fit-outline-line-text fit-outline-line-thigh-text">Thigh</div>
          </div>

          <div id="fit-outline-inner">
            <div class="fit-outline-line fit-outline-line-chest"></div>
            <div class="fit-outline-line fit-outline-line-n-waist"></div>
            <div class="fit-outline-line fit-outline-line-p-waist"></div>
            <div class="fit-outline-line fit-outline-line-h-hip"></div>
            <div class="fit-outline-line fit-outline-line-l-hip"></div>
            <div class="fit-outline-line fit-outline-line-thigh-l"></div>
            <div class="fit-outline-line fit-outline-line-thigh-r"></div>

            <img id="tfr-fit-outline-img" src="${imageBaseUrl}fit-outline.png" />
          </div>

          <div id="fit-outline-inner-right">
            <div id="fit-subtitle" class="mobile-hidden">Measurement&nbsp;Points</div>

            <div class="fit-outline-line-text fit-outline-line-chest-text">Chest/Bust</div>
            <div class="fit-outline-line-text fit-outline-line-n-waist-text">Natural&nbsp;Waist</div>
            <div class="fit-outline-line-text fit-outline-line-h-hip-text">High&nbsp;Hip</div>
            <div class="fit-outline-line-text fit-outline-line-l-hip-text">Low&nbsp;Hip</div>
          </div>
        </div>
      </div>

      <div id="cta-section">
        <div id="cta-link">Sign Up or Login</div>

        <div class="powered-by">
          <div>Powered by</div>
          <div class="tfr-powered-by-logo">${tfrDoor}</div>
          <div class="tfr-powered-by-text-bold">The Fitting Room</div>
        </div>
      </div>
    `
  }

  return {
    Hook,
    Unhook,
    Body,
    useFullModalContent: false,
  }
}

export default FitModal
