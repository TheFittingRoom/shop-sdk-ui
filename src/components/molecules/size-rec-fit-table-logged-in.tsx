import { useRecommendation } from '@hooks/use-recommendation'
import { SizeRecTableRow } from './size-rec-table-row'

export const SizeRecFitTableLoggedIn = () => {
  const { recommendation, selectedSize } = useRecommendation()

  if (!recommendation?.recommended || !recommendation?.sizes?.length) return null

  const locations = recommendation.sizes[selectedSize.index].locations.map((location) => ({
    location: location.location,
    fit: location.fit,
    isPerfect: location.isPerfect,
  }))

  return (
    <div className="tfr-fit-table">
      {locations.map((location, index) => (
        <SizeRecTableRow
          key={`location-${index}`}
          location={location.location}
          fit={location.fit}
          isPerfect={location.isPerfect || false}
        />
      ))}
    </div>
  )
}
