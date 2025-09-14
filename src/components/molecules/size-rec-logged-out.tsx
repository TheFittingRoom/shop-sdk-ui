import { Icon } from '@atoms/icon'
import { InteractiveDiv } from '@atoms/interactive-div'

interface SizeRecLoggedOutProps {
  collapsed: boolean
  onSignInClick: () => void
}

export const SizeRecLoggedOut = ({ collapsed, onSignInClick }: SizeRecLoggedOutProps) => {
  return (
    <div className="tfr-flex tfr-gap tfr-mb-2 tfr-mobile-small-text">
      <div>Uncertain of your size?</div>
      {collapsed ? (
        <div className="tfr-toggle-closed">
          <div className="tfr-flex tfr-items-center">
            <div>Try</div>
            <Icon name="tfrDoor" className="tfr-powered-by-logo" />
            <div className="tfr-powered-by-text-bold">The Fitting Room</div>
          </div>
        </div>
      ) : (
        <div className="tfr-toggle-open">
          <InteractiveDiv id="tfr-login-to-view" className="tfr-flex tfr-items-center" onClick={onSignInClick}>
            <Icon name="user" />
            <span>Login to view</span>
          </InteractiveDiv>
        </div>
      )}
    </div>
  )
}
