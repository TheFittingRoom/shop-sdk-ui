import { FirestoreColorwaySizeAsset, Fit, FitNames, FittingRoomAPI } from '../api'
import { RecommendedSize, SizeRecComponent } from './SizeRecommendationComponent'

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

export class SizeRecommendationController {
  private readonly sizeRecComponent: SizeRecComponent
  private readonly perfectFits = [Fit.PERFECT_FIT, Fit.SLIGHTLY_LOOSE, Fit.SLIGHTLY_TIGHT]

  constructor(
    sizeRecMainDiv: HTMLDivElement,
    cssVariables: TFRCssVariables,
    private readonly FittingRoomAPI: FittingRoomAPI,
    private readonly signInClickCallback: () => void,
    private readonly logoutCallback: () => void,
    private readonly fitInfoCallback: () => void,
    private readonly tryOnCallback: (selectedSku: string, availableSkus: string[]) => Promise<void>,
  ) {
    this.setCssVariables(sizeRecMainDiv, cssVariables)

    this.sizeRecComponent = new SizeRecComponent(
      sizeRecMainDiv,
      this.onSignInClickCallback.bind(this),
      this.onTryOnCallback.bind(this),
      this.onLogoutCallback.bind(this),
      this.onFitInfoCallback.bind(this)
    )
  }

  private onSignInClickCallback(): void {
    this.signInClickCallback()
  }

  private onLogoutCallback(): void {
    this.logoutCallback()
  }

  private onFitInfoCallback(): void {
    this.fitInfoCallback()
  }

  private onTryOnCallback(selectedSku: string, availableSkus: string[]) {
    this.tryOnCallback(selectedSku, availableSkus)
  }

  public async setLoggedOutStyleMeasurementLocations(locations: string[] = []) {
    if (locations.length == 0) {
      throw new Error('filteredLocations passed to setGarmentLocations is 0')
    }
    console.debug('filledLocations', locations)

    this.sizeRecComponent.SetSizeRecommendationLoading(false)
    this.sizeRecComponent.setStyleMeasurementLocations(locations)
    this.sizeRecComponent.ShowLoggedOut()
    this.sizeRecComponent.Show()
  }

  public async StartSizeRecommendation(styleId: number, colorwaySizeAssets: FirestoreColorwaySizeAsset[]) {
    console.debug('StartSizeRecommendation', styleId, colorwaySizeAssets)
    try {
      this.sizeRecComponent.SetSizeRecommendationLoading(true)

      const sizes = await this.getRecommendedSizes(styleId, colorwaySizeAssets)
      if (!sizes) {
        console.error('No sizes found for sku')
        this.sizeRecComponent.SetSizeRecommendationLoading(false)
        return
      }

      this.sizeRecComponent.ShowLoggedIn()
      this.sizeRecComponent.Show()
      this.sizeRecComponent.setRecommendedSize(sizes)
      this.sizeRecComponent.SetSizeRecommendationLoading(false)
    } catch (e) {
      console.error(e)
      this.sizeRecComponent.Hide()
      this.sizeRecComponent.SetSizeRecommendationLoading(false)
    }
  }

  private async getRecommendedSizes(
    styleId: number,
    colorwaySizeAssets: FirestoreColorwaySizeAsset[],
  ): Promise<RecommendedSize> {
    const sizeRec = await this.FittingRoomAPI.GetRecommendedSizes(styleId)

    if (!sizeRec) {
      console.debug('no size rec found')
      return null
    }

    if (!sizeRec.recommended_size?.size_value?.name) {
      console.debug('no recommended size value found')
      return null
    }

    if (!sizeRec.fits?.length) {
      console.debug('no fits found')
      return null
    }

    return {
      recommended: sizeRec.recommended_size.size_value.name,
      sizes: sizeRec.fits
        .map((fit) => {
          const colorwayAsset = colorwaySizeAssets.find((asset) => asset.size_id === fit.size_id)

          if (!colorwayAsset) {
            console.debug(`no colorway asset found for size_id: ${fit.size_id}`)
          }

          const availableSize = sizeRec.available_sizes?.find((size) => size.id === fit.size_id)
          if (!availableSize) {
            console.debug(`size with id ${fit.size_id} not found in available sizes`)
            return null
          }

          return {
            size: availableSize.size_value.name,
            size_id: fit.size_id,
            sku: colorwayAsset?.sku || '',
            locations:
              fit.measurement_location_fits
                ?.map((locationFit) => {
                  const fitLabel =
                    typeof locationFit.fit_label === 'string' && locationFit.fit_label
                      ? locationFit.fit_label
                      : FitNames[locationFit.fit]

                  return {
                    fit: fitLabel,
                    isPerfect: this.perfectFits.includes(locationFit.fit),
                    location: this.FittingRoomAPI.GetMeasurementLocationName(locationFit.measurement_location),
                    sortOrder: this.FittingRoomAPI.GetMeasurementLocationSortOrder(locationFit.measurement_location),
                  }
                })
                .filter((location) => location !== null) // Filter out null locations
                .sort((a, b) => (a.sortOrder < b.sortOrder ? -1 : 1)) || [],
          }
        })
        .filter((size) => size !== null), // Filter out null sizes
    }
  }

  private setCssVariables(sizeRecMainDiv: HTMLDivElement, cssVariables: TFRCssVariables) {
    const r = sizeRecMainDiv

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

  public Hide() {
    this.sizeRecComponent.Hide()
  }

  public Show() {
    this.sizeRecComponent.Show()
  }

  public ShowLoggedOut() {
    this.sizeRecComponent.ShowLoggedOut()

  }
  public ShowLoggedIn() {
    this.sizeRecComponent.ShowLoggedIn()
  }

  public ShowTryOnButton() {
    this.sizeRecComponent.showTryOnButton()
  }

  public DisableTryOnButton(message: string) {
    this.sizeRecComponent.disableTryOnButton(message)
  }

  public EnableTryOnButton() {
    this.sizeRecComponent.enableTryOnButton()
  }

  public ShowSizeRecommendationLoading() {
    console.debug("show sizerec loading")
    this.sizeRecComponent.SetSizeRecommendationLoading(true)
  }

  public HideSizeRecommendationLoading() {
    console.debug("hiding sizerec loading")
    this.sizeRecComponent.SetSizeRecommendationLoading(false)
  }

  public ShowVTOLoading() {
    console.debug("show vto loading")
    this.sizeRecComponent.SetVTOLoading(true)
  }

  public HideVTOLoading() {
    console.debug("show vto loading")
    this.sizeRecComponent.SetVTOLoading(false)
  }
}

