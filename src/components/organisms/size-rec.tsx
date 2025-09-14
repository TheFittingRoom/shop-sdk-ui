import { Button } from '@atoms/button'
import { Icon } from '@atoms/icon'
import { LoadingSpinner } from '@atoms/loading-spinner'
import { FitModalContainer } from '@components/modals/fit-modal-container'
import { ScanCodeModalContainer } from '@components/modals/scan-code-modal-container'
import { useAuthContext } from '@contexts/auth-context'
import { useModalContext } from '@contexts/modal-context'
import { useSizeRecContext } from '@contexts/size-rec-context'
import { useGarmentLocations } from '@hooks/use-garment-locations'
import { useRecommendation } from '@hooks/use-recommendation'
import { PoweredByFooter } from '@molecules/powered-by-footer'
import { SizeRecFitTable } from '@molecules/size-rec-fit-table'
import { SizeRecHeaderToggle } from '@molecules/size-rec-header-toggle'
import { SizeRecLoggedInSummary } from '@molecules/size-rec-logged-in-summary'
import { SizeRecLoggedOut } from '@molecules/size-rec-logged-out'
import { SizeRecSelect } from '@molecules/size-rec-select'
import { TryOnButton } from '@molecules/try-on-button'
import { useEffect } from 'preact/hooks'

export interface RecommendedSize {
  recommended: string
  sizes: Array<{
    size: string
    size_id: number
    locations?: Array<{
      location: string
      fit: string
      isPerfect?: boolean
    }>
  }>
}

export const SizeRec = () => {
  const auth = useAuthContext()
  const modalManager = useModalContext()
  const sizeRec = useSizeRecContext()
  const { isLoading: isGarmentLocationsLoading } = useGarmentLocations()

  const { recommendation, isLoading: isRecommendationLoading, error } = useRecommendation()
  const isLoading = isGarmentLocationsLoading || isRecommendationLoading

  useEffect(() => {
    console.log('isGarmentLocationsLoading', { isGarmentLocationsLoading })
    console.log('isRecommendationLoading', { isRecommendationLoading })
    console.log('isLoading', { isLoading })
  }, [isGarmentLocationsLoading, isRecommendationLoading])

  const isCollapsed = sizeRec.isCollapsed
  const isLoggedIn = auth.isLoggedIn

  const handleToggleCollapse = () => {
    sizeRec.setIsCollapsed(!isCollapsed)
  }

  const handleSignInClick = () => {
    console.log('handleSignInClick')
    console.log('modalManager', { modalManager })
    modalManager.openModal(<ScanCodeModalContainer />)
  }

  const handleFitInfoClick = () => {
    modalManager.openModal(<FitModalContainer />)
  }

  const handleSignOutClick = async () => {
    await auth.signOut()
  }

  const handleTryOnButtonClick = () => {
    // recommendation?.selectSize(sizeRec.selectedSize)
  }

  return (
    <div id="tfr-size-recommendations">
      {isLoading ? (
        <LoadingSpinner id="tfr-size-rec-loading" isVisible={isLoading} size="medium" />
      ) : (
        <div id="tfr-size-recommendations-container" style={{ display: 'flex' }}>
          <SizeRecHeaderToggle collapsed={isCollapsed} onToggle={handleToggleCollapse} />

          {!isLoggedIn && (
            <div className="tfr-logged-out">
              <SizeRecLoggedOut collapsed={isCollapsed} onSignInClick={handleSignInClick} />
            </div>
          )}

          {isLoggedIn && (
            <div className="tfr-logged-in">
              <SizeRecLoggedInSummary recommended={recommendation?.recommended} error={error} />
            </div>
          )}

          {!isCollapsed && (
            <div className="tfr-toggle-open" style={{ width: '100%' }}>
              <div id="tfr-size-rec-select-container">
                <div id="tfr-size-how-it-fits" style={{ opacity: isLoggedIn ? '1' : '0.4' }}>
                  Select size to see how it fits:
                </div>

                <div id="tfr-size-rec-select" style={{ opacity: isLoggedIn ? '1' : '0.4' }}>
                  <SizeRecSelect />
                </div>

                <div id="tfr-size-rec-subtitle">
                  How it fits
                  <span
                    id="tfr-info-icon"
                    onClick={handleFitInfoClick}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label="Fit information"
                  >
                    <Icon name="info" />
                  </span>
                </div>

                <div id="tfr-size-rec-table">
                  <SizeRecFitTable />
                </div>

                <TryOnButton
                  loading={isLoading}
                  visible={isLoggedIn && !!recommendation?.sizes.length}
                  onClick={handleTryOnButtonClick}
                />
              </div>
            </div>
          )}

          <div id="tfr-size-rec-action">
            <Button
              id={!isLoggedIn ? 'tfr-size-rec-action-logout' : 'tfr-size-rec-action-login'}
              variant="primary"
              onClick={!isLoggedIn ? handleSignInClick : handleSignOutClick}
            >
              {isLoggedIn ? 'Log out' : 'Sign up or login'}
            </Button>
          </div>

          <PoweredByFooter isVisible={!isCollapsed} />

          <div
            id="tfr-size-recommendation-error"
            style={{
              display: error && isLoggedIn ? 'block' : 'none',
            }}
          >
            {error || 'No recommended size found.'}
          </div>
        </div>
      )}
    </div>
  )
}
