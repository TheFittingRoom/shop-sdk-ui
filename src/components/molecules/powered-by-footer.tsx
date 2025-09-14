import { Icon } from '@atoms/icon'

export interface PoweredByFooterProps {
  isVisible?: boolean
}

export const PoweredByFooter = ({ isVisible = true }: PoweredByFooterProps) => {
  if (!isVisible) return null

  return (
    <div className="tfr-toggle-open">
      <div className="tfr-powered-by">
        <div>Powered by</div>
        <Icon name="tfrDoor" className="tfr-powered-by-logo" />
        <div className="tfr-powered-by-text-bold">The Fitting Room</div>
      </div>
    </div>
  )
}
