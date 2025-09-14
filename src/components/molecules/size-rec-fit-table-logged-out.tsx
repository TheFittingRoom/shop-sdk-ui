import { useGarmentLocations } from '@hooks/use-garment-locations'

import { SizeRecTableRow } from './size-rec-table-row'

export const SizeRecFitTableLoggedOut = () => {
  const { garmentLocations } = useGarmentLocations()

  console.log('garmentLocations', { garmentLocations })

  const getRandomFit = (index: number): string => {
    const choices = ['Slightly Tight', 'Perfect Fit', 'Perfect Fit', 'Slightly Loose', 'Perfect Fit']
    return choices[index % choices.length]
  }

  return (
    <div id="tfr-logged-out-overlay-container">
      <div id="tfr-logged-out-overlay">
        Login to reveal how this item will fit specifically at each area of your body in different sizes
      </div>
      <div>
        {garmentLocations.map((location, index) => {
          const fit = getRandomFit(index)

          return (
            <SizeRecTableRow
              key={`location-${index}`}
              location={location.name}
              fit={fit}
              isPerfect={fit === 'Perfect Fit'}
            />
          )
        })}
      </div>
    </div>
  )
}
