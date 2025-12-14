import { Fit, FittingRoomAPI } from '../api'
import { GarmentMeasurement, MeasurementLocationFit, Size, SizeFitRecommendation } from '../api/gen/responses'
import { SizeRecComponent } from './SizeRecommendationComponent'

export interface MeasurementLocationFitWithPerfectFit extends MeasurementLocationFit {
  isPerfectFit: boolean
}

export interface SizeMeasurementLocationFits extends Size {
  isRecommended: boolean
  measurementLocationFits: MeasurementLocationFitWithPerfectFit[]
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
  // TODO move perfect fit logic to CSS fit attributes
  private readonly perfectFits = [Fit.PERFECT_FIT, Fit.SLIGHTLY_LOOSE, Fit.SLIGHTLY_TIGHT]
  private sizeFitRecommendationPromise: Promise<SizeFitRecommendation>

  constructor(
    sizeRecMainDiv: HTMLDivElement,
    cssVariables: TFRCssVariables,
    private readonly fittingRoomAPI: FittingRoomAPI,
    private readonly signInClickCallback: () => void,
    private readonly logoutCallback: () => void,
    private readonly fitInfoCallback: () => void,
    private readonly tryOnCallback: (selectedSizeID: number, availableSizeIDs: number[]) => Promise<void>,
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

  public setLoggedOutStyleMeasurementLocations(garmentMeasurementLocations: GarmentMeasurement[] = []) {
    if (garmentMeasurementLocations.length === 0) {
      throw new Error('filteredLocations passed to setGarmentLocations is 0')
    }
    console.debug('filledLocations', garmentMeasurementLocations)

    this.sizeRecComponent.SetSizeRecommendationLoading(false)
    this.sizeRecComponent.SetStyleMeasurementLocations(garmentMeasurementLocations)
    this.sizeRecComponent.ShowLoggedOut()
    this.sizeRecComponent.Show()
  }

  /**
   * Retrieves size recommendations for a given style ID and processes the data for display.
   */
  public async GetSizeRecommendationByStyleID(styleId: number) {
    console.debug('start size recommendation', styleId)
    try {
      this.Show()
      this.SetSizeRecommendationLoading(true)
      this.sizeFitRecommendationPromise = this.fittingRoomAPI.GetRecommendedSizes(styleId)

      const sizeFitRecommendation = await this.sizeFitRecommendationPromise

      if (!sizeFitRecommendation?.recommended_size) {
        this.sizeRecComponent.ShowLoggedIn()
        this.sizeRecComponent.Show()
        this.sizeRecComponent.ShowSizeRecommendationError('No sizes were recommended.')
        return
      }

      const sizeMeasurementLocationFits: SizeMeasurementLocationFits[] = sizeFitRecommendation.available_sizes
        .map((size) => {
          const sizeMeasurementLocationFit: SizeMeasurementLocationFits = {
            isRecommended: size.id === sizeFitRecommendation.recommended_size.id,
            ...size,
            measurementLocationFits: [],
          }
          const matchingFit = sizeFitRecommendation.fits.find((sizeFit) => sizeFit.size_id === size.id)
          if (matchingFit) {
            matchingFit.measurement_location_fits.forEach((measurementLocationFit) => {
              sizeMeasurementLocationFit.measurementLocationFits.push({
                ...measurementLocationFit,
                isPerfectFit: this.perfectFits.includes(measurementLocationFit.fit),
              })
            })
          }
          return sizeMeasurementLocationFit
        })
        .sort((a, b) => (a.size_value?.id || 0) - (b.size_value?.id || 0))

      this.sizeRecComponent.ShowLoggedIn()
      this.sizeRecComponent.Show()
      this.sizeRecComponent.HideSizeRecommendationError()
      this.sizeRecComponent.SetRecommendedSize(sizeMeasurementLocationFits)
    } catch (e: unknown) {
      console.error('error in get size recommendation', e)
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
    console.debug('SetVTOLoading', isLoading)
    this.sizeRecComponent.SetVTOLoading(isLoading)
  }

  public CurrentSizeRecommendation(): Promise<SizeFitRecommendation> | null {
    return this.sizeFitRecommendationPromise
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
