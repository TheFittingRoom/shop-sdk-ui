import { types as ShopTypes, TfrShop } from '@thefittingroom/sdk'

import { RecommendedSize, SizeRecComponent } from './components/SizeRec'

export class TfrSizeRec {
  private readonly sizeRecComponent: SizeRecComponent

  constructor(
    sizeRecMainDivId: string,
    private readonly tfrShop: TfrShop,
    private readonly onSignInClick: () => void,
    private readonly onSignOutClick: () => void,
  ) {
    this.sizeRecComponent = new SizeRecComponent(sizeRecMainDivId, this.onSignInClick, this.onSignOutClick)
  }

  public get sku() {
    return this.sizeRecComponent.sku
  }

  public setSku(sku: string) {
    this.sizeRecComponent.setSku(sku)
  }

  public setIsLoggedIn(isLoggedIn: boolean) {
    this.sizeRecComponent.setIsLoggedIn(isLoggedIn)
  }

  public async setGarmentLocations() {
    this.sizeRecComponent.setLoading(true)
    const locations = await this.getGarmentLocations()
    if (!locations) return this.sizeRecComponent.setLoading(false)

    this.sizeRecComponent.setGarmentLocations(locations)
    this.sizeRecComponent.setLoading(false)
  }

  public async setRecommendedSize() {
    this.sizeRecComponent.setLoading(true)
    const sizes = await this.getRecommenedSize()
    if (!sizes) {
      console.error('No sizes found for sku')
      this.sizeRecComponent.setLoading(false)
      this.sizeRecComponent.setError()

      return
    }

    this.sizeRecComponent.setRecommendedSize(sizes)
    this.sizeRecComponent.setLoading(false)
  }

  private async getGarmentLocations(): Promise<string[]> {
    try {
      const locations = await this.tfrShop.getMeasurementLocationsFromSku(this.sku)

      return locations
    } catch (error) {
      console.error(error)
      this.sizeRecComponent.setError()
      return null
    }
  }

  private async getRecommenedSize() {
    try {
      const colorwaySizeAsset = await this.tfrShop.getColorwaySizeAssetFromSku(this.sku)
      const sizes = await this.getRecommendedSizes(String(colorwaySizeAsset.style_id))

      return sizes
    } catch (error) {
      console.error(error)
      this.sizeRecComponent.setError()
      return null
    }
  }

  private async getRecommendedSizes(styleId: string): Promise<RecommendedSize> {
    const sizeRec = await this.tfrShop.getRecommendedSizes(styleId)

    if (!sizeRec) return null

    return {
      recommended: sizeRec.recommended_size.size_value.size,
      sizes: sizeRec.fits.map((fit) => {
        return {
          size: sizeRec.available_sizes.find((size) => size.id === fit.size_id).size_value.size,
          locations: fit.measurement_location_fits.map((locationFit) => {
            return {
              fit: ShopTypes.FitNames[locationFit.fit],
              location: ShopTypes.MeasurementLocationName[locationFit.measurement_location],
            }
          }),
        }
      }),
    }
  }
}
