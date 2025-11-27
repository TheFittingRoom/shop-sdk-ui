import { FirestoreColorwaySizeAsset, Fit, FitNames, FittingRoomAPI } from '../api'
import { MeasurementLocationFit, SizeFit, SizeFitRecommendation } from '../api/gen/responses'
import { RecommendedSize, SizeRecComponent } from './SizeRecommendationComponent'

type LocationItem = {
  fit: string
  isPerfect: boolean
  location: string
  sortOrder: number
}

type SizeItem = {
  size: string
  size_id: number
  sku: string
  locations: LocationItem[]
}

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
      this.signInClickCallback,
      this.tryOnCallback,
      this.logoutCallback,
      this.fitInfoCallback,
    )
  }

  public setLoggedOutStyleMeasurementLocations(locations: string[] = []) {
    if (locations.length == 0) {
      throw new Error('filteredLocations passed to setGarmentLocations is 0')
    }
    console.debug('filledLocations', locations)

    this.sizeRecComponent.SetSizeRecommendationLoading(false)
    this.sizeRecComponent.SetStyleMeasurementLocations(locations)
    this.sizeRecComponent.ShowLoggedOut()
    this.sizeRecComponent.Show()
  }

  public async GetSizeRecommendationByStyleID(styleId: number, colorwaySizeAssets: FirestoreColorwaySizeAsset[]) {
    console.debug('StartSizeRecommendation', styleId, colorwaySizeAssets)
    try {
      this.SetSizeRecommendationLoading(true)

      const sizes = await this.getRecommendedSizes(styleId, colorwaySizeAssets)
      if (!sizes) {
        console.error('No sizes found for sku')
        return
      }

      this.sizeRecComponent.ShowLoggedIn()
      this.sizeRecComponent.Show()
      this.sizeRecComponent.SetRecommendedSize(sizes)
    } catch (e) {
      console.error(e)
      this.sizeRecComponent.Hide()
    } finally {
      this.SetSizeRecommendationLoading(false)
    }
  }

  public Hide() {
    this.sizeRecComponent.Hide()
  }

  public Show() {
    console.debug('SizeRecommendationContoller.Show')
    this.sizeRecComponent.Show()
  }

  public ShowLoggedOut() {
    this.sizeRecComponent.ShowLoggedOut()
  }

  public ShowLoggedIn() {
    console.debug('SizeRecommendationContoller.ShowLoggedIn')
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

  public SetSizeRecommendationLoading(isLoading: boolean) {
    console.debug(isLoading ? 'show sizerec loading' : 'hiding sizerec loading')
    this.sizeRecComponent.SetSizeRecommendationLoading(isLoading)
  }

  public SetVTOLoading(isLoading: boolean) {
    console.debug(isLoading ? 'show vto loading' : 'hide vto loading')
    this.sizeRecComponent.SetVTOLoading(isLoading)
  }

  public SetColorwayID(colorwayId: number): void {
    this.sizeRecComponent.SetColorwayID(colorwayId)
  }

  private async getRecommendedSizes(
    styleId: number,
    colorwaySizeAssets: FirestoreColorwaySizeAsset[],
  ): Promise<RecommendedSize> {
    console.debug('getRecommendedSizes', styleId, colorwaySizeAssets)
    const sizeRec = await this.FittingRoomAPI.GetRecommendedSizes(styleId)

    if (!this.isValidSizeRec(sizeRec)) {
      return null
    }

    return {
      recommended: sizeRec.recommended_size.size_value.name,
      sizes: this.buildSizes(sizeRec, colorwaySizeAssets),
    }
  }

  private isValidSizeRec(sizeRec: SizeFitRecommendation | null): boolean {
    console.debug('isValidSizeRec', sizeRec)
    if (!sizeRec) {
      console.debug('no size rec found')
      return false
    }

    if (!sizeRec.recommended_size?.size_value?.name) {
      console.debug('no recommended size value found')
      return false
    }

    if (!sizeRec.fits?.length) {
      console.debug('no fits found')
      return false
    }

    return true
  }

  private buildSizes(sizeRec: SizeFitRecommendation, colorwaySizeAssets: FirestoreColorwaySizeAsset[]): SizeItem[] {
    console.debug('buildSizes', sizeRec, colorwaySizeAssets)
    return sizeRec.fits.map((fit) => this.buildSize(fit, sizeRec, colorwaySizeAssets)).filter((size) => size !== null)
  }

  private buildSize(
    fit: SizeFit,
    sizeRec: SizeFitRecommendation,
    colorwaySizeAssets: FirestoreColorwaySizeAsset[],
  ): SizeItem | null {
    console.debug('buildSize', fit, sizeRec, colorwaySizeAssets)
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
      locations: this.buildLocations(fit),
    }
  }

  private buildLocations(fit: SizeFit): LocationItem[] {
    console.debug('buildLocations', fit)
    return (
      fit.measurement_location_fits
        ?.map((locationFit) => this.buildLocation(locationFit))
        .filter((location) => location !== null)
        .sort((a, b) => (a.sortOrder < b.sortOrder ? -1 : 1)) || []
    )
  }

  private buildLocation(locationFit: MeasurementLocationFit): LocationItem {
    console.debug('buildLocation', locationFit)
    const fitLabel =
      typeof locationFit.fit_label === 'string' && locationFit.fit_label
        ? locationFit.fit_label
        : FitNames[locationFit.fit]

    const measurementLocation = this.FittingRoomAPI.measurementLocations.get(locationFit.measurement_location)
    return {
      fit: fitLabel,
      isPerfect: this.perfectFits.includes(locationFit.fit),
      location: measurementLocation?.garment_label || locationFit.measurement_location,
      sortOrder: measurementLocation?.sort_order ?? Infinity,
    }
  }

  private setCssVariables(sizeRecMainDiv: HTMLDivElement, cssVariables: TFRCssVariables) {
    const toKebabCase = (str: string) => str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()

    for (const [key, value] of Object.entries(cssVariables)) {
      if (value) {
        sizeRecMainDiv.style.setProperty(`--tfr-${toKebabCase(key)}`, value)
      }
    }
  }
}
