import { Button } from '@atoms/button'

interface TryOnButtonProps {
  loading: boolean
  visible: boolean
  onClick: () => void
}

export const TryOnButton = ({ loading, visible, onClick }: TryOnButtonProps) => {
  if (!visible) return null

  return (
    <Button
      id="tfr-try-on-button"
      variant="primary"
      className={`tfr-try-on-button${loading ? ' loading' : ''}`}
      onClick={onClick}
      disabled={loading}
      ariaLabel="Try on selected size"
    >
      {loading ? ' ' : 'Try On'}
    </Button>
  )
}
