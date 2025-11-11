import { Fit, FitNames, TFRShop } from './api'
import { RecommendedSize, SizeRecComponent } from './components/SizeRec'

export type TFRCssVariables = {
  brandColor?: string
  black?: string
  red?: string
  white?: string
  muted?: string
  dark?: string
  grey?: string
  lightGrey?: string
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
  sizeSelectorTextColor?: string
  sizeSelectorFontSize?: string
  sizeSelectorFontWeight?: string
  sizeSelectorBorderColor?: string
  sizeSelectorBorderWidth?: string
  sizeSelectorBgColor?: string
  sizeSelectorBgColorHover?: string
  sizeSelectorBgColorActive?: string
  sizeSelectorButtonHeight?: string
  sizeSelectorButtonActiveHeight?: string
  sizeSelectorButtonActiveBorderColor?: string
  sizeSelectorButtonActiveBorderWidth?: string
  sizeSelectorButtonRadius?: string
  sizeSelectorButtonShadow?: string
}

export class TFRSizeRec {
  private readonly sizeRecComponent: SizeRecComponent
  private readonly perfectFits = [Fit.PERFECT_FIT, Fit.SLIGHTLY_LOOSE, Fit.SLIGHTLY_TIGHT]

  constructor(
    sizeRecMainDivId: string,
    cssVariables: TFRCssVariables,
    private readonly tfrShop: TFRShop,
    private readonly onSignInClick: () => void,
    private readonly onSignOutClick: () => void,
    private readonly onFitInfoClick: () => void,
    private readonly onTryOnClick: (sku: string, shouldDisplay: boolean, isFromTryOnButton?: boolean) => Promise<void>,
  ) {
    this.setCssVariables(cssVariables)
    this.sizeRecComponent = new SizeRecComponent(
      sizeRecMainDivId,
      this.onSignInClick,
      this.onSignOutClick,
      this.onFitInfoClick,
      this.onTryOnClick,
      this.tfrShop.isLoggedIn,
    )
  }

  public get sku() {
    return this.sizeRecComponent.sku
  }

  public setSku(sku: string) {
    this.sizeRecComponent.setSku(sku)
  }

  public get styleId() {
    return this.sizeRecComponent.styleId
  }

  public setStyleId(styleId: number) {
    this.sizeRecComponent.setStyleId(styleId)
  }

  public setIsLoggedIn(isLoggedIn: boolean) {
    this.sizeRecComponent.setIsLoggedIn(isLoggedIn)
  }

  public async setStyleMeasurementLocations(locations: string[] = []) {
    this.sizeRecComponent.setLoading(true)
    if (locations.length == 0) {
      throw new Error('filteredLocations passed to setGarmentLocations is 0')
    }
    console.debug('filledLocations', locations)

    this.sizeRecComponent.setStyleMeasurementLocations(locations)
    this.sizeRecComponent.setLoading(false)
    this.sizeRecComponent.show()
  }

  public async startSizeRecommendation() {
    try {
      const colorwaySizeAsset = await this.tfrShop.getColorwaySizeAssetFromSku(this.sku)
      this.setStyleId(colorwaySizeAsset.style_id)
      if (!this.styleId) {
        throw new Error('this.styleId')
      }
      this.sizeRecComponent.setLoading(true)
      const sizes = await this.getRecommendedSizes(this.styleId)
      if (!sizes) {
        console.error('No sizes found for sku')
        this.sizeRecComponent.setLoading(false)
        return
      }

      this.sizeRecComponent.show()
      this.sizeRecComponent.setRecommendedSize(sizes)
      this.sizeRecComponent.setLoading(false)
    } catch (e) {
      console.error(e)
      this.sizeRecComponent.hide()
      this.sizeRecComponent.setLoading(false)
    }
  }

  public async getStyleMeasurementLocations(filledLocations: string[]): Promise<string[]> {
    try {
      const locations = await this.tfrShop.getMeasurementLocationsFromSku(this.sku, filledLocations)

      return locations
    } catch (error) {
      console.error(error)
      this.sizeRecComponent.hide()
      return null
    }
  }

  private async getRecommendedSizes(styleId: number): Promise<RecommendedSize> {
    const sizeRec = await this.tfrShop.getRecommendedSizes(styleId)

    if (!sizeRec) return null

    // Fetch all colorway size assets for this style to get SKUs
    const colorwaySizeAssets = await this.tfrShop.getColorwaySizeAssetsFromStyleId(styleId)

    return {
      recommended: sizeRec.recommended_size.size_value.name,
      sizes: sizeRec.fits.map((fit) => {
        // Find the corresponding colorway size asset for this size_id
        const colorwayAsset = colorwaySizeAssets.find((asset) => asset.size_id === fit.size_id)

        return {
          size: sizeRec.available_sizes.find((size) => size.id === fit.size_id).size_value.name,
          size_id: fit.size_id,
          sku: colorwayAsset?.sku || '',
          locations: fit.measurement_location_fits
            .map((locationFit) => {
              const fitLabel =
                typeof locationFit.fit_label === 'string' && locationFit.fit_label
                  ? locationFit.fit_label
                  : FitNames[locationFit.fit]

              return {
                fit: fitLabel,
                isPerfect: this.perfectFits.includes(locationFit.fit),
                location: this.tfrShop.getMeasurementLocationName(locationFit.measurement_location),
                sortOrder: this.tfrShop.getMeasurementLocationSortOrder(locationFit.measurement_location),
              }
            })
            .sort((a, b) => (a.sortOrder < b.sortOrder ? -1 : 1)),
        }
      }),
    }
  }

  private setCssVariables(cssVariables: TFRCssVariables) {
    const r = document.querySelector<HTMLElement>(':root')

    if (cssVariables.brandColor) r.style.setProperty('--tfr-brand-color', cssVariables.brandColor)
    if (cssVariables.black) r.style.setProperty('--tfr-black', cssVariables.black)
    if (cssVariables.red) r.style.setProperty('--tfr-red', cssVariables.red)
    if (cssVariables.white) r.style.setProperty('--tfr-white', cssVariables.white)
    if (cssVariables.muted) r.style.setProperty('--tfr-muted', cssVariables.muted)
    if (cssVariables.dark) r.style.setProperty('--tfr-dark', cssVariables.dark)
    if (cssVariables.grey) r.style.setProperty('--tfr-grey', cssVariables.grey)
    if (cssVariables.lightGrey) r.style.setProperty('--tfr-light-grey', cssVariables.lightGrey)
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

    // Size Selector
    if (cssVariables.sizeSelectorTextColor)
      r.style.setProperty('--tfr-size-selector-text-color', cssVariables.sizeSelectorTextColor)
    if (cssVariables.sizeSelectorFontSize)
      r.style.setProperty('--tfr-size-selector-font-size', cssVariables.sizeSelectorFontSize)
    if (cssVariables.sizeSelectorFontWeight)
      r.style.setProperty('--tfr-size-selector-font-weight', cssVariables.sizeSelectorFontWeight)
    if (cssVariables.sizeSelectorBgColor)
      r.style.setProperty('--tfr-size-selector-bg-color', cssVariables.sizeSelectorBgColor)
    if (cssVariables.sizeSelectorBorderColor)
      r.style.setProperty('--tfr-size-selector-border-color', cssVariables.sizeSelectorBorderColor)
    if (cssVariables.sizeSelectorBorderWidth)
      r.style.setProperty('--tfr-size-selector-border-width', cssVariables.sizeSelectorBorderWidth)
    if (cssVariables.sizeSelectorBgColorHover)
      r.style.setProperty('--tfr-size-selector-bg-color-hover', cssVariables.sizeSelectorBgColorHover)
    if (cssVariables.sizeSelectorBgColorActive)
      r.style.setProperty('--tfr-size-selector-bg-color-active', cssVariables.sizeSelectorBgColorActive)
    if (cssVariables.sizeSelectorButtonHeight)
      r.style.setProperty('--tfr-size-selector-button-height', cssVariables.sizeSelectorButtonHeight)
    if (cssVariables.sizeSelectorButtonActiveHeight)
      r.style.setProperty('--tfr-size-selector-button-active-height', cssVariables.sizeSelectorButtonActiveHeight)
    if (cssVariables.sizeSelectorButtonActiveBorderColor)
      r.style.setProperty(
        '--tfr-size-selector-button-active-border-color',
        cssVariables.sizeSelectorButtonActiveBorderColor,
      )
    if (cssVariables.sizeSelectorButtonActiveBorderWidth)
      r.style.setProperty(
        '--tfr-size-selector-button-active-border-width',
        cssVariables.sizeSelectorButtonActiveBorderWidth,
      )
    if (cssVariables.sizeSelectorButtonRadius)
      r.style.setProperty('--tfr-size-selector-button-radius', cssVariables.sizeSelectorButtonRadius)
    if (cssVariables.sizeSelectorButtonShadow)
      r.style.setProperty('--tfr-size-selector-button-shadow', cssVariables.sizeSelectorButtonShadow)
  }
}
