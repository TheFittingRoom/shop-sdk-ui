export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  isVisible?: boolean
  id?: string
}

export const LoadingSpinner = ({ size = 'medium', isVisible = true, id }: LoadingSpinnerProps) => {
  const sizeClass = `lds-ellipsis-${size}`

  return (
    <div id={id} className={`tfr-loading-spinner ${sizeClass}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <div className="lds-ellipsis">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  )
}
