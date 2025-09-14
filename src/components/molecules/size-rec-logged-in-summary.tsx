import { Icon } from '@atoms/icon'

interface SizeRecLoggedInSummaryProps {
  recommended?: string
  error?: string
}

export const SizeRecLoggedInSummary = ({ recommended, error }: SizeRecLoggedInSummaryProps) => {
  const showTitle = !error

  return (
    <div id="tfr-size-rec-title" style={{ display: showTitle ? 'flex' : 'none' }}>
      Recommended Size:
      <div id="tfr-size-rec-size">
        {recommended ? (
          ` ${recommended}`
        ) : (
          <div className="tfr-size-rec-login-cta">
            <Icon name="user" />
            <span>Sign up to view</span>
          </div>
        )}
      </div>
    </div>
  )
}
