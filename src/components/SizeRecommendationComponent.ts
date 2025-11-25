import { infoIcon, tfrDoor, userIcon } from '../assets/svgs'

export type RecommendedSize = {
  recommended: string
  sizes: {
    size: string
    size_id: number
    sku: string
    locations: {
      fit: string
      isPerfect: boolean
      location: string
    }[]
  }[]
}

export class SizeRecComponent {
  private availableSizes: RecommendedSize['sizes'] = []

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

  private isLoggedIn: boolean = false

  constructor(
    sizeRecMainDiv: HTMLDivElement,
    private readonly onSignInClickCallback: () => void,
    private readonly onTryOnCallback: (selectedSku: string, availableSkus: string[]) => void,
    private readonly onSignOutCallback: () => void,
    private readonly onFitInfoCallback: () => void,
  ) {
    this.init(sizeRecMainDiv)
  }

  private onSignInClick(): void {
    console.debug("onSignInClick")

    try {
      this.onSignInClickCallback()
    } catch (error) {
      console.debug('Could not get state for sign-in callback:', error)
    }
  }

  private onSignOutClick(): void {
    console.debug("onSignOutClick")
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
    this.tfrSizeHowItFits.classList.remove("logged-in")
    this.tfrSizeRecSelect.classList.remove("logged-in")
    this.tfrSizeRecSelectContainer.classList.remove("logged-in")

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

    this.tfrSizeHowItFits.classList.add("logged-in")
    this.tfrSizeRecSelect.classList.add("logged-in")
    this.tfrSizeRecSelectContainer.classList.add("logged-in")

    this.tfrLoggedInElements.forEach((element) => (element as HTMLElement).classList.remove('hide'))
    this.tfrSizeRecActionLogout.classList.remove('hide')
    this.tfrSizeRecTitle.classList.remove('hide')
    this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')

    this.tfrLoggedOutElements.forEach((element) => (element as HTMLElement).classList.add('hide'))
    this.tfrSizeRecActionLogin.classList.add('hide')
    this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
  }

  public SetSizeRecommendationLoading(isLoading: boolean) {
    if (isLoading) {
      this.tfrSizeRecLoading.classList.remove('hide')
      this.tfrSizeRecommendationsContainer.classList.add('hide')
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

  public setStyleMeasurementLocations(locations: string[]) {
    if (!locations || !locations.length) {
      this.tfrSizeRecTitle.classList.add('hide')

      return
    }

    this.renderGarmentLocations(locations)
  }

  public setRecommendedSize({ recommended, sizes }: RecommendedSize) {
    this.renderSizeRec(recommended, sizes)
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

  public disableTryOnButton(message: string) {
    this.tfrTryOnButton.disabled = true;
    this.tfrTryOnButton.title = message; // Set hover message
    this.tfrTryOnButton.classList.add('disabled'); // Add disabled styling if needed
  }

  public enableTryOnButton() {
    this.tfrTryOnButton.disabled = false;
    this.tfrTryOnButton.title = ''; // Clear hover message
    this.tfrTryOnButton.classList.remove('disabled'); // Remove disabled styling
  }

  private init(sizeRecMainDiv: HTMLDivElement) {
    if (!sizeRecMainDiv) throw new Error('Size rec main div not found')
    this.sizeRecMainDiv = sizeRecMainDiv
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
    selectedSku: string;
    availableSkus: string[];
  } {
    const activeButton = this.sizeRecMainDiv.querySelector('.tfr-size-rec-select-button.active');
    if (!activeButton) {
      throw new Error("no active button found");
    }

    const selectedIndex = Number(activeButton.getAttribute('data-index'));
    if (Number.isNaN(selectedIndex) || !this.availableSizes[selectedIndex]) {
      throw new Error("no selectedIndex found");
    }

    const selectedSku = this.availableSizes[selectedIndex].sku;
    if (!selectedSku) {
      throw new Error("no selectedSku found");
    }

    const skusToLoad: string[] = [selectedSku];

    if (selectedIndex > 0 && this.availableSizes[selectedIndex - 1]?.sku) {
      skusToLoad.push(this.availableSizes[selectedIndex - 1].sku);
    }
    if (selectedIndex < this.availableSizes.length - 1 && this.availableSizes[selectedIndex + 1]?.sku) {
      skusToLoad.push(this.availableSizes[selectedIndex + 1].sku);
    }

    return { selectedSku, availableSkus: skusToLoad };
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
    console.debug("onTryOnClick")
    e.preventDefault()

    if (!this.isLoggedIn) {
      this.onSignInClick()
      return
    }

    this.SetVTOLoading(true)

    // Get the state and call the try-on callback with the selected SKU and available SKUs
    try {
      const { selectedSku, availableSkus } = this.GetSizeRecommendationState()
      this.onTryOnCallback(selectedSku, availableSkus)
    } catch (error) {
      console.error('Error getting try-on state:', error)
      this.SetVTOLoading(false)
    }
  }

  private onSizeRecSelectClick(e: MouseEvent) {
    console.debug("onSizeRecSelectClick")

    const target = e.target as HTMLDivElement
    if (!target.classList.contains('tfr-size-rec-select-button') || target.classList.contains('tfr-disabled')) return

    e.preventDefault()

    const selectedIndex = Number(target.getAttribute('data-index'))
    if (Number.isNaN(selectedIndex)) return

    const allButtons = this.sizeRecMainDiv.querySelectorAll('.tfr-size-rec-select-button')

    allButtons.forEach((button) => button.classList.remove('active'))
    allButtons.item(selectedIndex).classList.add('active')

    this.redraw(selectedIndex)
  }

  private renderSizeRec(recommended: string, sizes: RecommendedSize['sizes']) {
    this.tfrSizeRecSize.innerHTML = `&nbsp;${recommended}`

    // Store available sizes for try-on operations
    this.availableSizes = sizes

    const selectedSizeIndex = sizes.findIndex(({ size }) => size === recommended)

    this.redraw = (index: number) => this.renderSizeRecTable(sizes, index)

    this.redraw(selectedSizeIndex)
    this.renderSizeRecSelect(sizes, selectedSizeIndex)
  }

  private renderSizeRecTable(sizes: RecommendedSize['sizes'], index: number) {
    const { locations } = sizes[index]
    const html = locations
      .map(({ location, fit, isPerfect }) => this.renderSizeRecTableRow(location, fit, isPerfect))
      .join('')

    this.tfrSizeRecTable.innerHTML = html
  }

  private renderSizeRecSelect(sizes: RecommendedSize['sizes'], index: number) {
    const sizeNames = sizes.map(({ size }) => size)
    const html = sizeNames
      .map(
        (name, i) =>
          `<div class="tfr-size-rec-select-button ${i === index ? 'active' : ''}" data-index="${i}" data-sku="${sizes[i].sku
          }">${name}</div>`,
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

  private renderSizeRecTableRow(location: string, fit: string, isPerfect: boolean = false) {
    return `<div class="tfr-size-rec-table-row">
              <div class="tfr-size-rec-table-cell-left">${location}</div>
              <div class="tfr-size-rec-table-cell-right ${isPerfect ? 'perfect' : ''}">
                ${fit}
              </div>
            </div>`
  }

  private renderGarmentLocations(locations: string[]) {
    const innerHtml = locations
      .map((location, index) => this.renderSizeRecTableRow(location, this.randomFit(index), true))
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

  private randomFit(index: number) {
    const choices = ['Slightly Tight', 'Perfect Fit', 'Perfect Fit', 'Slightly Loose', 'Perfect Fit']

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
                    <div id="tfr-size-rec-loading">
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
                          
                          <div class="tfr-toggle-closed">
                            <div class="tfr-flex tfr-items-center">
                              <div>Try</div>
                              <div class="tfr-powered-by-logo">${tfrDoor}</div>
                              <div class="tfr-powered-by-text-bold">The&nbsp;Fitting&nbsp;Room</div>
                            </div>
                          </div>

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

}
