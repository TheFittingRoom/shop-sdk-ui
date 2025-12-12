import {
  Fit,
  HorizontalFit,
  HorizontalFitLoose,
  HorizontalFitOversized,
  HorizontalFitPerfectFit,
  HorizontalFitSlightlyLoose,
  HorizontalFitSlightlyTight,
  HorizontalFitTight,
  HorizontalFitTooTight,
} from '../api/gen/enums'
import { GarmentMeasurement } from '../api/gen/responses'
import { infoIcon, tfrDoor, userIcon } from '../assets/svgs'
import { MeasurementLocationFitWithPerfectFit, SizeMeasurementLocationFits } from './SizeRecommendationController'

export class SizeRecComponent {
  private availableSizes: SizeMeasurementLocationFits[] = []

  private sizeRecMainDiv: HTMLDivElement

  private tfrInfoIcon: HTMLDivElement
  private tfrLoginToView: HTMLDivElement
  private tfrSizeHowItFits: HTMLDivElement
  private tfrSizeRecActionLogin: HTMLDivElement
  private tfrSizeRecActionLogout: HTMLDivElement
  private tfrSizeRecLoading: HTMLDivElement
  private tfrSizeRecommendationError: HTMLDivElement
  private tfrSizeRecommendationsContainer: HTMLDivElement
  private tfrSizeRecSelect: HTMLDivElement
  private tfrSizeRecSelectContainer: HTMLDivElement
  private tfrSizeRecSize: HTMLDivElement
  private tfrSizeRecTable: HTMLDivElement
  private tfrSizeRecTitle: HTMLDivElement
  private tfrSizeRecTitleToggle: HTMLDivElement
  private tfrTryOnButton: HTMLButtonElement

  private tfrLoggedInElements: NodeList = [] as any as NodeList
  private tfrLoggedOutElements: NodeList = [] as any as NodeList

  private tfrToggleOpenElements: NodeList = [] as any as NodeList
  private tfrToggleClosedElements: NodeList = [] as any as NodeList

  private isCollapsed: boolean = false
  private redraw: (index: number) => void = null

  private tryOnClicked: boolean = false

  private isLoggedIn: boolean = false

  constructor(
    sizeRecMainDiv: HTMLDivElement,
    private readonly onSignInClickCallback: () => void,
    private readonly onTryOnCallback: (
      selectedSizeID: number,
      availableSizeIDs: number[],
      fromSizeRecSelect: boolean,
    ) => void,
    private readonly onSignOutCallback: () => void,
    private readonly onFitInfoCallback: () => void,
  ) {
    this.init(sizeRecMainDiv)
  }

  private onSignInClick(): void {
    console.debug('onSignInClick')

    try {
      this.onSignInClickCallback()
    } catch (error) {
      console.debug('Could not get state for sign-in callback:', error)
    }
  }

  private onSignOutClick(): void {
    console.debug('onSignOutClick')
    this.ShowLoggedOut()
    if (this.onSignOutCallback) {
      this.onSignOutCallback()
    }
  }

  private onFitInfoClick(): void {
    if (this.onFitInfoCallback) {
      this.onFitInfoCallback()
    }
  }

  public ShowLoggedOut() {
    this.isLoggedIn = false
    console.debug('ShowLoggedOut')
    this.tfrSizeHowItFits.classList.remove('logged-in')
    this.tfrSizeRecSelect.classList.remove('logged-in')
    this.tfrSizeRecSelectContainer.classList.remove('logged-in')

    this.tfrLoggedInElements.forEach((element) => (element as HTMLElement).classList.add('hide'))
    this.tfrLoggedOutElements.forEach((element) => (element as HTMLElement).classList.remove('hide'))
    this.tfrSizeRecSelectContainer.classList.remove('hide')
    this.tfrSizeRecSelect.classList.remove('hide')
    this.tfrSizeRecActionLogin.classList.remove('hide')
    this.tfrSizeRecActionLogout.classList.add('hide')

    this.tfrSizeRecTitle.classList.remove('hide')

    this.renderSizeRecSelectLoggedOut()
  }

  public ShowLoggedIn() {
    this.isLoggedIn = true
    this.isCollapsed = false

    this.tfrSizeHowItFits.classList.add('logged-in')
    this.tfrSizeRecSelect.classList.add('logged-in')
    this.tfrSizeRecSelectContainer.classList.add('logged-in')

    this.tfrLoggedInElements.forEach((element) => (element as HTMLElement).classList.remove('hide'))
    this.tfrSizeRecActionLogout.classList.remove('hide')
    this.tfrSizeRecTitle.classList.remove('hide')
    this.tfrSizeRecSelectContainer.classList.remove('hide')
    this.tfrSizeRecSelect.classList.remove('hide')
    this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')

    this.tfrLoggedOutElements.forEach((element) => (element as HTMLElement).classList.add('hide'))
    this.tfrSizeRecActionLogin.classList.add('hide')
    this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
  }

  public SetSizeRecommendationLoading(isLoading: boolean) {
    console.debug('SetSizeRecommendationLoading', isLoading)
    if (isLoading) {
      this.tfrSizeRecommendationsContainer.classList.add('hide')
      this.tfrSizeRecLoading.classList.remove('hide')
    } else {
      this.tfrSizeRecLoading.classList.add('hide')
      this.tfrSizeRecommendationsContainer.classList.remove('hide')
    }
  }

  public SetVTOLoading(isLoading: boolean) {
    this.tfrTryOnButton.disabled = isLoading
    if (isLoading) {
      this.tfrTryOnButton.classList.add('loading')
    } else {
      this.tfrTryOnButton.classList.remove('loading')
    }
  }

  public ShowSizeRecommendationError(message: string) {
    console.debug('ShowSizeRecommendationError', message)
    this.tfrSizeRecommendationError.innerHTML = message
    this.tfrSizeRecommendationError.classList.remove('hide')
    this.tfrSizeRecommendationsContainer.classList.add('hide')
  }

  public HideSizeRecommendationError() {
    console.debug('HideSizeRecommendationError')
    this.tfrSizeRecommendationError.classList.add('hide')
    this.tfrSizeRecommendationsContainer.classList.remove('hide')
  }

  public SetStyleMeasurementLocations(garmentMeasurementLocations: GarmentMeasurement[]) {
    if (!garmentMeasurementLocations || !garmentMeasurementLocations.length) {
      this.tfrSizeRecTitle.classList.add('hide')

      return
    }

    this.renderGarmentLocations(garmentMeasurementLocations)
  }

  public SetRecommendedSize(sizeMeasurementLocationFits: SizeMeasurementLocationFits[]) {
    this.renderSizeRec(sizeMeasurementLocationFits)
  }

  public Hide() {
    if (this.sizeRecMainDiv) {
      this.sizeRecMainDiv.classList.add('hide')
    }
  }

  public Show() {
    if (this.sizeRecMainDiv) {
      this.sizeRecMainDiv.classList.remove('hide')
    }
  }

  public showTryOnButton() {
    this.tfrTryOnButton.classList.remove('hide')
  }

  public hideTryOnButton() {
    this.tfrTryOnButton.classList.add('hide')
  }

  public disableTryOnButton(message: string) {
    this.tfrTryOnButton.disabled = true
    this.tfrTryOnButton.title = message // Set hover message
    this.tfrTryOnButton.classList.add('disabled') // Add disabled styling if needed
  }

  public enableTryOnButton() {
    this.tfrTryOnButton.disabled = false
    this.tfrTryOnButton.title = '' // Clear hover message
    this.tfrTryOnButton.classList.remove('disabled') // Remove disabled styling
  }

  private init(sizeRecMainDiv: HTMLDivElement) {
    if (!sizeRecMainDiv) throw new Error('Size rec main div not found')
    this.sizeRecMainDiv = sizeRecMainDiv
    this.sizeRecMainDiv.classList.add('hide')
    this.render(sizeRecMainDiv)
    this.setElements(sizeRecMainDiv)
    this.bindEvents()
  }

  private setElements(sizeRecMainDiv: HTMLDivElement) {
    this.tfrSizeHowItFits = sizeRecMainDiv.querySelector('#tfr-size-how-it-fits') as HTMLDivElement
    this.tfrSizeRecTitle = sizeRecMainDiv.querySelector('#tfr-size-rec-title') as HTMLDivElement
    this.tfrTryOnButton = this.sizeRecMainDiv.querySelector('#tfr-try-on-button')
    this.tfrInfoIcon = sizeRecMainDiv.querySelector('#tfr-info-icon') as HTMLDivElement
    this.tfrLoginToView = sizeRecMainDiv.querySelector('#tfr-login-to-view') as HTMLDivElement
    this.tfrSizeRecActionLogin = sizeRecMainDiv.querySelector('#tfr-size-rec-action-login') as HTMLDivElement
    this.tfrSizeRecActionLogout = sizeRecMainDiv.querySelector('#tfr-size-rec-action-logout') as HTMLDivElement
    this.tfrSizeRecTable = sizeRecMainDiv.querySelector('#tfr-size-rec-table') as HTMLDivElement
    this.tfrSizeRecommendationError = sizeRecMainDiv.querySelector('#tfr-size-recommendation-error') as HTMLDivElement
    this.tfrSizeRecSize = sizeRecMainDiv.querySelector('#tfr-size-rec-size') as HTMLDivElement
    this.tfrSizeRecSelect = sizeRecMainDiv.querySelector('#tfr-size-rec-select') as HTMLDivElement
    this.tfrSizeRecLoading = sizeRecMainDiv.querySelector('#tfr-size-rec-loading') as HTMLDivElement
    this.tfrSizeRecTitleToggle = sizeRecMainDiv.querySelector('#tfr-size-rec-title-toggle') as HTMLDivElement
    this.tfrSizeRecSelectContainer = sizeRecMainDiv.querySelector('#tfr-size-rec-select-container') as HTMLDivElement
    this.tfrSizeRecommendationsContainer = sizeRecMainDiv.querySelector(
      '#tfr-size-recommendations-container',
    ) as HTMLDivElement
    this.tfrLoggedInElements = sizeRecMainDiv.querySelectorAll('.tfr-logged-in')
    this.tfrLoggedOutElements = sizeRecMainDiv.querySelectorAll('.tfr-logged-out')
    this.tfrToggleOpenElements = sizeRecMainDiv.querySelectorAll('.tfr-toggle-open')
    this.tfrToggleClosedElements = sizeRecMainDiv.querySelectorAll('.tfr-toggle-closed')
  }

  public GetSizeRecommendationState(): {
    selectedID: number
    availableIDs: number[]
  } {
    const activeButton = this.sizeRecMainDiv.querySelector('.tfr-size-rec-select-button.active')
    if (!activeButton) {
      throw new Error('no active button found')
    }

    const selectedIndex = Number(activeButton.getAttribute('data-index'))
    if (Number.isNaN(selectedIndex) || !this.availableSizes[selectedIndex]) {
      throw new Error('no selectedIndex found')
    }

    const selectedID = this.availableSizes[selectedIndex].id
    if (!selectedID) {
      throw new Error('no selectedSku found')
    }

    const availableSizeIDs: number[] = [selectedID]

    if (selectedIndex > 0 && this.availableSizes[selectedIndex - 1]?.id) {
      availableSizeIDs.push(this.availableSizes[selectedIndex - 1].id)
    }
    if (selectedIndex < this.availableSizes.length - 1 && this.availableSizes[selectedIndex + 1]?.id) {
      availableSizeIDs.push(this.availableSizes[selectedIndex + 1].id)
    }

    return { selectedID: selectedID, availableIDs: availableSizeIDs }
  }

  private bindEvents() {
    this.tfrSizeRecActionLogin.addEventListener('click', this.onSignInClick.bind(this))
    this.tfrSizeRecActionLogout.addEventListener('click', this.onSignOutClick.bind(this))
    this.tfrSizeRecSelect.addEventListener('click', this.onSizeRecSelectClick.bind(this))
    this.tfrSizeRecTitleToggle.addEventListener('click', this.toggleSizeRecSelectContainer.bind(this))
    this.tfrInfoIcon.addEventListener('click', this.onFitInfoClick.bind(this))
    this.tfrLoginToView.addEventListener('click', this.onSignInClick.bind(this))

    this.tfrTryOnButton.addEventListener('click', this.onTryOnClick.bind(this))
  }

  private onTryOnClick(e: MouseEvent) {
    console.debug('onTryOnClick')
    e.preventDefault()
    this.onTryOn(false)
  }

  private onTryOn(fromSizeRecSelect: boolean) {
    if (!this.isLoggedIn) {
      this.onSignInClick()
      return
    }

    this.tryOnClicked = true

    this.SetVTOLoading(true)

    try {
      const { selectedID, availableIDs } = this.GetSizeRecommendationState()
      this.onTryOnCallback(selectedID, availableIDs, fromSizeRecSelect)
    } catch (error) {
      console.error('Error getting try-on state:', error)
      this.SetVTOLoading(false)
    }
  }

  private onSizeRecSelectClick(e: MouseEvent) {
    const target = e.target as HTMLDivElement
    if (!target.classList.contains('tfr-size-rec-select-button') || target.classList.contains('tfr-disabled')) return

    e.preventDefault()

    const selectedIndex = Number(target.getAttribute('data-index'))
    if (Number.isNaN(selectedIndex)) return

    console.log('onSizeRecSelectClick', selectedIndex)

    const allButtons = this.sizeRecMainDiv.querySelectorAll('.tfr-size-rec-select-button')

    allButtons.forEach((button) => button.classList.remove('active'))
    allButtons.item(selectedIndex).classList.add('active')

    this.redraw(selectedIndex)

    // if the user already triggered a try on event then trigger a try on
    if (this.tryOnClicked) {
      this.onTryOn(true)
    }
  }

  private renderSizeRec(sizeMeasurementLocationFits: SizeMeasurementLocationFits[]) {
    const selectedSizeIndex = sizeMeasurementLocationFits.findIndex((size) => size.isRecommended)
    const selectedSize = sizeMeasurementLocationFits[selectedSizeIndex]
    const selectedSizeLabel = selectedSize.label || selectedSize.size_value?.name || selectedSize.id
    this.tfrSizeRecSize.innerHTML = `&nbsp;${selectedSizeLabel}`

    this.availableSizes = sizeMeasurementLocationFits

    this.redraw = (index: number) => this.renderSizeRecTable(sizeMeasurementLocationFits, index)

    this.redraw(selectedSizeIndex)
    this.renderSizeRecSelect(sizeMeasurementLocationFits, selectedSizeIndex)
  }

  private renderSizeRecTable(sizeOptions: SizeMeasurementLocationFits[], index: number) {
    const html = sizeOptions[index].measurementLocationFits
      .map((measurementLoctionFit) => this.renderSizeRecTableRow(measurementLoctionFit))
      .join('')

    this.tfrSizeRecTable.innerHTML = html
  }

  private renderSizeRecSelect(sizeMeasurementLocationFits: SizeMeasurementLocationFits[], index: number) {
    const html = sizeMeasurementLocationFits
      .map(
        (size, i) =>
          `<div class="tfr-size-rec-select-button ${i === index ? 'active' : ''}" data-index="${i}">${size.label || size.size_value?.name || size.id}</div>`,
      )
      .join('')

    this.tfrSizeRecSelect.innerHTML = html
  }

  private renderSizeRecSelectLoggedOut() {
    const html = [
      `<div class="tfr-size-rec-select-button tfr-disabled">M</div>`,
      `<div class="tfr-size-rec-select-button tfr-disabled active">L</div>`,
      `<div class="tfr-size-rec-select-button tfr-disabled">XL</div>`,
    ].join('')

    this.tfrSizeRecSelect.innerHTML = html
  }

  // TODO: move perfect fit logic to CSS fit attributes
  private renderSizeRecTableRow(fit: MeasurementLocationFitWithPerfectFit) {
    return `<div class="tfr-size-rec-table-row">
              <div class="tfr-size-rec-table-cell-left">${this.fitToTitleCase(fit.measurement_location)}</div>
              <div class="tfr-size-rec-table-cell-right ${fit.isPerfectFit ? 'perfect' : ''}">
                ${this.fitToTitleCase(fit.fit_label || fit.fit)}
              </div>
            </div>`
  }

  private renderGarmentLocations(locations: GarmentMeasurement[]) {
    const fakeMeasurementLocationFitWithPerfectFit: MeasurementLocationFitWithPerfectFit[] = []
    locations.forEach((location, index) => {
      const fit = this.randomFit(index)
      fakeMeasurementLocationFitWithPerfectFit.push({
        measurement_location: location.measurement_location,
        fit,
        isPerfectFit: false,
        sort_order: index,
        fit_label: '',
        group: '',
        group_label: '',
      })
    })

    const innerHtml = fakeMeasurementLocationFitWithPerfectFit
      .map((fakeMeasurementLocationFitWithPerfectFit) =>
        this.renderSizeRecTableRow(fakeMeasurementLocationFitWithPerfectFit),
      )
      .join('')
    const html = `<div id="tfr-logged-out-overlay-container">
                    <div id="tfr-logged-out-overlay">
                      Login to reveal how this item will fit specifically at each area of your body in different sizes
                    </div>
                    <div>
                      ${innerHtml}
                    </div>
                  </div>`

    this.tfrSizeRecTable.innerHTML = html
  }

  private randomFit(index: number): Fit {
    const choices: HorizontalFit[] = [
      HorizontalFitTooTight,
      HorizontalFitTight,
      HorizontalFitSlightlyTight,
      HorizontalFitPerfectFit,
      HorizontalFitSlightlyLoose,
      HorizontalFitLoose,
      HorizontalFitOversized,
    ]

    return choices[index % choices.length]
  }

  private toggleSizeRecSelectContainer() {
    if (this.isCollapsed) {
      this.isCollapsed = false
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')
      this.tfrToggleOpenElements.forEach((element) => (element as HTMLElement).classList.remove('hide'))
      this.tfrToggleClosedElements.forEach((element) => (element as HTMLElement).classList.add('hide'))
    } else {
      this.isCollapsed = true
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-down')
      this.tfrToggleOpenElements.forEach((element) => (element as HTMLElement).classList.add('hide'))
      this.tfrToggleClosedElements.forEach((element) => (element as HTMLElement).classList.remove('hide'))
    }
  }

  private render(sizeRecMainDiv: HTMLDivElement) {
    const body = `<div id="tfr-size-recommendations">
                    <div id="tfr-size-rec-loading" class="hide">
                      <div class="lds-ellipsis">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                      </div>
                    </div>
                    <div id="tfr-size-recommendations-container" class="hide">
                      <div id="tfr-size-rec-title-toggle" class="tfr-chevron-up">v</div>

                      <div class="tfr-logged-out">
                        <div class="tfr-flex tfr-gap tfr-mb-2 tfr-mobile-small-text">
                          <div>Uncertain&nbsp;of&nbsp;your&nbsp;size?</div>
                          
          

                          <div class="tfr-toggle-open">
                            <div id="tfr-login-to-view" class="tfr-flex tfr-items-center">
                              ${userIcon} Login to view
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="tfr-logged-in">
                        <div id="tfr-size-rec-title">
                          Recommended Size:
                          <div id="tfr-size-rec-size">
                            <div class="tfr-size-rec-login-cta">
                              ${userIcon} Sign up to view
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="tfr-toggle-open" style="width: 100%">
                        <div id="tfr-size-rec-select-container" class="hide">
                          <div id="tfr-size-how-it-fits">Select size to see how it fits:</div>

                          <div id="tfr-size-rec-select" class="hide"></div>

                          <div id="tfr-size-rec-subtitle">
                            How it fits
                            <span id="tfr-info-icon">${infoIcon}</span>
                          </div>

                          <div id="tfr-size-rec-table"></div>

                          <button id="tfr-try-on-button" class="hide">Try On</button>
                        </div>
                      </div>

                      <div id="tfr-size-rec-action">
                        <div id="tfr-size-rec-action-login">Sign up or login</div>
                        <div id="tfr-size-rec-action-logout" class="hide">Log out</div>
                      </div>

                      <div class="tfr-toggle-open">
                        <div class="tfr-powered-by">
                          <div>Powered by</div>
                          <div class="tfr-powered-by-logo">${tfrDoor}</div>
                          <div class="tfr-powered-by-text-bold">The Fitting Room</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div id="tfr-size-recommendation-error"></div>`

    sizeRecMainDiv.innerHTML = body
  }

  private fitToTitleCase(fit: string): string {
    return fit
      .split(/[_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
}
