import { types as ShopTypes, TfrShop } from '@thefittingroom/sdk'

import { RecommendedSize, SizeRecComponent } from './components/SizeRec'

export type TfrCssVariables = {
  brandColor?: string
  black?: string
  red?: string
  white?: string
  muted?: string
  dark?: string
  mainBorderColor?: string
  mainBorderRadius?: string
  mainBorderWidth?: string
  mainBgColor?: string
  mainWidth?: string
  mainVPadding?: string
  mainHPadding?: string
  mainFont?: string
  titleFont?: string
  subtitleFont?: string
  rowFont?: string
  ctaFont?: string
}

export class TfrSizeRec {
  private readonly sizeRecComponent: SizeRecComponent
  private readonly perfectFits = [ShopTypes.Fit.PERFECT_FIT, ShopTypes.Fit.SLIGHTLY_LOOSE, ShopTypes.Fit.SLIGHTLY_TIGHT]

  constructor(
    sizeRecMainDivId: string,
    cssVariables: TfrCssVariables,
    private readonly tfrShop: TfrShop,
    private readonly onSignInClick: () => void,
    private readonly onSignOutClick: () => void,
  ) {
    this.setCssVariables(cssVariables)
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
    console.debug('locations', locations)

    this.sizeRecComponent.setGarmentLocations(locations || [])
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
      try {
        const style = await this.tfrShop.getStyleByBrandStyleId(this.sku)
        const sizes = await this.getRecommendedSizes(String(style.id))

        return sizes
      } catch (error) {
        console.error(error)
        this.sizeRecComponent.setError()
        return null
      }
    }
  }

  private async getRecommendedSizes(styleId: string): Promise<RecommendedSize> {
    const sizeRec = await this.tfrShop.getRecommendedSizes(styleId)

    if (!sizeRec) return null

    return {
      recommended: sizeRec.recommended_size.label,
      sizes: sizeRec.fits.map((fit) => {
        return {
          size: sizeRec.available_sizes.find((size) => size.id === fit.size_id).label,
          locations: fit.measurement_location_fits.map((locationFit) => {
            return {
              fit: ShopTypes.FitNames[locationFit.fit],
              isPerfect: this.perfectFits.includes(locationFit.fit),
              location: ShopTypes.MeasurementLocationName[locationFit.measurement_location],
            }
          }),
        }
      }),
    }
  }

  private setCssVariables(cssVariables: TfrCssVariables) {
    const r = document.querySelector<HTMLElement>(':root')

    if (cssVariables.brandColor) r.style.setProperty('--tfr-brand-color', cssVariables.brandColor)
    if (cssVariables.black) r.style.setProperty('--tfr-black', cssVariables.black)
    if (cssVariables.red) r.style.setProperty('--tfr-red', cssVariables.red)
    if (cssVariables.white) r.style.setProperty('--tfr-white', cssVariables.white)
    if (cssVariables.muted) r.style.setProperty('--tfr-muted', cssVariables.muted)
    if (cssVariables.dark) r.style.setProperty('--tfr-dark', cssVariables.dark)
    if (cssVariables.mainBorderColor) r.style.setProperty('--tfr-main-border-color', cssVariables.mainBorderColor)
    if (cssVariables.mainBorderRadius) r.style.setProperty('--tfr-main-border-radius', cssVariables.mainBorderRadius)
    if (cssVariables.mainBorderWidth) r.style.setProperty('--tfr-main-border-width', cssVariables.mainBorderWidth)
    if (cssVariables.mainBgColor) r.style.setProperty('--tfr-main-bg-color', cssVariables.mainBgColor)
    if (cssVariables.mainWidth) r.style.setProperty('--tfr-main-width', cssVariables.mainWidth)
    if (cssVariables.mainVPadding) r.style.setProperty('--tfr-main-v-padding', cssVariables.mainVPadding)
    if (cssVariables.mainHPadding) r.style.setProperty('--tfr-main-h-padding', cssVariables.mainHPadding)
    if (cssVariables.mainFont) r.style.setProperty('--tfr-main-font', cssVariables.mainFont)
    if (cssVariables.titleFont) r.style.setProperty('--tfr-title-font', cssVariables.titleFont)
    if (cssVariables.subtitleFont) r.style.setProperty('--tfr-subtitle-font', cssVariables.subtitleFont)
    if (cssVariables.rowFont) r.style.setProperty('--tfr-row-font', cssVariables.rowFont)
    if (cssVariables.ctaFont) r.style.setProperty('--tfr-cta-font', cssVariables.ctaFont)
  }
}
