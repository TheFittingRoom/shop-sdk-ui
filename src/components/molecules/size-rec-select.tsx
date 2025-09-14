import { Button } from '@atoms/button'
import { useAuthContext } from '@contexts/auth-context'
import { type Size, useRecommendation } from '@hooks/use-recommendation'

export const SizeRecSelect = () => {
  const { isLoggedIn } = useAuthContext()
  const { recommendation, selectedSize, selectSize } = useRecommendation()

  if (!isLoggedIn) {
    return (
      <div className="tfr-size-rec-select-disabled">
        <Button variant="secondary" disabled className="tfr-size-rec-select-button tfr-disabled">
          M
        </Button>
        <Button variant="secondary" disabled className="tfr-size-rec-select-button tfr-disabled active">
          L
        </Button>
        <Button variant="secondary" disabled className="tfr-size-rec-select-button tfr-disabled">
          XL
        </Button>
      </div>
    )
  }

  if (!recommendation?.sizes || recommendation?.sizes.length === 0) {
    return <div className="tfr-size-rec-select-empty"></div>
  }

  const handleSelect = (index: number, size: Size) => {
    selectSize({ ...size, index })
  }

  return (
    <div className="tfr-size-rec-select-buttons">
      {recommendation?.sizes.map((size, index) => {
        const isActive = size.size_id === selectedSize.index

        return (
          <Button
            key={`size-${size.size_id}`}
            variant={isActive ? 'primary' : 'secondary'}
            className={`tfr-size-rec-select-button${isActive ? ' active' : ''}`}
            onClick={() => handleSelect(index, size)}
            data-index={index.toString()}
            data-size-id={size.size_id.toString()}
          >
            {size.size}
          </Button>
        )
      })}
    </div>
  )
}
