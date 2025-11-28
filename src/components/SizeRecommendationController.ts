import { FirestoreColorwaySizeAsset, Fit, FittingRoomAPI } from '../api'
import { GarmentMeasurement, MeasurementLocationFit, Size } from '../api/gen/responses'
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

  constructor(
    sizeRecMainDiv: HTMLDivElement,
    cssVariables: TFRCssVariables,
    private readonly FittingRoomAPI: FittingRoomAPI,
    private readonly signInClickCallback: () => void,
    private readonly logoutCallback: () => void,
    private readonly FitInfoCallback: () => void,
    private readonly TryOnCallback: (selectedSizeID: number, availableSizeIDs: number[]) => Promise<void>,
  ) {
    this.setCssVariables(sizeRecMainDiv, cssVariables)

    this.sizeRecComponent = new SizeRecComponent(
      sizeRecMainDiv,
      this.signInClickCallback,
      this.TryOnCallback,
      this.logoutCallback,
      this.FitInfoCallback,
    )
  }

  public setLoggedOutStyleMeasurementLocations(garmentMeasurementLocations: GarmentMeasurement[] = []) {
    if (garmentMeasurementLocations.length == 0) {
      throw new Error('filteredLocations passed to setGarmentLocations is 0')
    }
    console.debug('filledLocations', garmentMeasurementLocations)

    this.sizeRecComponent.SetSizeRecommendationLoading(false)
    this.sizeRecComponent.SetStyleMeasurementLocations(garmentMeasurementLocations)
    this.sizeRecComponent.ShowLoggedOut()
    this.sizeRecComponent.Show()
  }

  public async GetSizeRecommendationByStyleID(styleId: number, colorwaySizeAssets: FirestoreColorwaySizeAsset[], colorwayId?: number) {
    console.debug('StartSizeRecommendation', styleId, colorwaySizeAssets, colorwayId)
    try {
      this.SetSizeRecommendationLoading(true)

      const sizeFitRecommendation = await this.FittingRoomAPI.GetRecommendedSizes(styleId)

      let sizeMeasurementLocationFits: SizeMeasurementLocationFits[]
      sizeFitRecommendation.available_sizes.forEach(size => {
        const sizeMeasurementLocationFit: SizeMeasurementLocationFits = {
          isRecommended: size.id == sizeFitRecommendation.recommended_size.id,
          ...size,
          measurementLocationFits: []
        }
        sizeFitRecommendation.fits.forEach(sizeFit => {
          if (sizeFit.size_id === size.id) {
            sizeFit.measurement_location_fits.forEach(measurementLocationFit => {
              sizeMeasurementLocationFit.measurementLocationFits.push({
                ...measurementLocationFit,
                isPerfectFit: this.perfectFits.includes(measurementLocationFit.fit)
              })
            })
          }
        })
      })


      this.sizeRecComponent.ShowLoggedIn()
      this.sizeRecComponent.Show()
      // todo  
      this.sizeRecComponent.SetRecommendedSize(sizeMeasurementLocationFits)
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

  private setCssVariables(sizeRecMainDiv: HTMLDivElement, cssVariables: TFRCssVariables) {
    const toKebabCase = (str: string) => str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()

    for (const [key, value] of Object.entries(cssVariables)) {
      if (value) {
        sizeRecMainDiv.style.setProperty(`--tfr-${toKebabCase(key)}`, value)
      }
    }
  }
}
