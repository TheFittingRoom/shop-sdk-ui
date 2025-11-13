import { infoIcon, tfrDoor, userIcon } from '../assets/svgs'
import { TFRAPI } from '../api/api'

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
  private _sku: string = ''
  private _styleId: number = null
  private isLoggedIn: boolean
  private availableSizes: RecommendedSize['sizes'] = []
  private tfrShop: TFRAPI
  private vtoComponent: any = null
  private hasInitializedTryOn: boolean = false
  private hasAttemptedTryOn: boolean = false

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

  private tfrLoggedInElements: NodeList = [] as any as NodeList
  private tfrLoggedOutElements: NodeList = [] as any as NodeList

  private tfrToggleOpenElements: NodeList = [] as any as NodeList
  private tfrToggleClosedElements: NodeList = [] as any as NodeList

  private isCollapsed: boolean = false
  private redraw: (index: number) => void = null

  constructor(
    sizeRecMainDivId: string,
    private readonly onSignInClick: () => void,
    private readonly onSignOutClick: () => void,
    private readonly onFitInfoClick: () => void,
    initialIsLoggedIn: boolean,
    tfrShop: TFRAPI,
    vtoComponent?: any,
    private readonly noCacheOnRetry: boolean = false,
  ) {
    this.isLoggedIn = initialIsLoggedIn
    this.tfrShop = tfrShop
    this.vtoComponent = vtoComponent
    this.noCacheOnRetry = noCacheOnRetry
    this.init(sizeRecMainDivId)
    this.setIsLoggedIn(this.isLoggedIn)
  }

  public get sku() {
    return this._sku
  }

  public setSku(sku: string) {
    this._sku = sku
  }

  public setVtoComponent(vtoComponent: any) {
    this.vtoComponent = vtoComponent
  }

  public get styleId() {
    return this._styleId
  }

  public setStyleId(styleId: number) {
    this._styleId = styleId
  }

  public setIsLoggedIn(isLoggedIn: boolean) {
    console.debug('SizeRecComponent.setIsLoggedIn called with:', isLoggedIn, 'current isLoggedIn:', this.isLoggedIn)
    this.isLoggedIn = isLoggedIn
    console.debug('SizeRecComponent.isLoggedIn set to:', this.isLoggedIn)
    this.tfrSizeRecSelectContainer.style.display = 'flex'
    this.tfrSizeRecSelect.style.display = 'flex'
    this.tfrSizeHowItFits.style.display = 'block'

    if (isLoggedIn) {
      this.tfrSizeHowItFits.style.opacity = '1'
      this.tfrSizeRecSelect.style.opacity = '1'
      this.tfrLoggedInElements.forEach((element) => ((element as HTMLElement).style.display = 'block'))
      this.tfrLoggedOutElements.forEach((element) => ((element as HTMLElement).style.display = 'none'))

      this.tfrSizeRecActionLogin.style.display = 'none'
      this.tfrSizeRecActionLogout.style.display = 'block'
      this.tfrSizeRecTitle.style.display = 'flex'
      this.isCollapsed = false
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')

      // Ensure the container is visible
      this.tfrSizeRecSelectContainer.style.display = 'flex'
      this.tfrSizeRecSelectContainer.style.opacity = '1'
    } else {
      this.tfrSizeHowItFits.style.opacity = '0.4'
      this.tfrSizeRecSelect.style.opacity = '0.4'
      this.tfrLoggedInElements.forEach((element) => ((element as HTMLElement).style.display = 'none'))
      this.tfrLoggedOutElements.forEach((element) => ((element as HTMLElement).style.display = 'block'))

      this.tfrSizeRecActionLogin.style.display = 'block'
      this.tfrSizeRecActionLogout.style.display = 'none'

      this.tfrSizeRecTitle.style.display = 'flex'
      this.tfrSizeRecommendationError.style.display = 'none'
      this.tfrSizeRecommendationError.innerHTML = ''

      this.renderSizeRecSelectLoggedOut()
    }
  }

  public setLoading(isLoading: boolean) {
    if (isLoading) {
      this.tfrSizeRecLoading.style.display = 'block'
      this.tfrSizeRecommendationsContainer.style.display = 'none'
    } else {
      this.tfrSizeRecLoading.style.display = 'none'
      this.tfrSizeRecommendationsContainer.style.display = 'flex'
    }
  }

  public setStyleMeasurementLocations(locations: string[]) {
    if (!locations || !locations.length) {
      this.tfrSizeRecTitle.style.display = 'none'

      return
    }

    this.renderGarmentLocations(locations)
  }

  public setRecommendedSize({ recommended, sizes }: RecommendedSize) {
    this.renderSizeRec(recommended, sizes)
  }

  public hide() {
    if (this.sizeRecMainDiv) {
      this.sizeRecMainDiv.style.display = 'none'
    }
  }

  public show() {
    if (this.sizeRecMainDiv) {
      this.sizeRecMainDiv.style.display = 'block'
    }
  }

  private init(sizeRecMainDivId: string) {
    const sizeRecMainDiv = document.getElementById(sizeRecMainDivId) as HTMLDivElement

    if (!sizeRecMainDiv) throw new Error('Size rec main div not found')

    this.sizeRecMainDiv = sizeRecMainDiv
    this.render(sizeRecMainDiv)
    this.setElements()
    this.bindEvents()
  }

  private setElements() {
    this.tfrSizeHowItFits = document.getElementById('tfr-size-how-it-fits') as HTMLDivElement
    this.tfrSizeRecTitle = document.getElementById('tfr-size-rec-title') as HTMLDivElement

    this.tfrInfoIcon = document.getElementById('tfr-info-icon') as HTMLDivElement
    this.tfrLoginToView = document.getElementById('tfr-login-to-view') as HTMLDivElement
    this.tfrSizeRecActionLogin = document.getElementById('tfr-size-rec-action-login') as HTMLDivElement
    this.tfrSizeRecActionLogout = document.getElementById('tfr-size-rec-action-logout') as HTMLDivElement
    this.tfrSizeRecTable = document.getElementById('tfr-size-rec-table') as HTMLDivElement
    this.tfrSizeRecommendationError = document.getElementById('tfr-size-recommendation-error') as HTMLDivElement
    this.tfrSizeRecSize = document.getElementById('tfr-size-rec-size') as HTMLDivElement
    this.tfrSizeRecSelect = document.getElementById('tfr-size-rec-select') as HTMLDivElement
    this.tfrSizeRecLoading = document.getElementById('tfr-size-rec-loading') as HTMLDivElement
    this.tfrSizeRecTitleToggle = document.getElementById('tfr-size-rec-title-toggle') as HTMLDivElement
    this.tfrSizeRecSelectContainer = document.getElementById('tfr-size-rec-select-container') as HTMLDivElement
    this.tfrSizeRecommendationsContainer = document.getElementById(
      'tfr-size-recommendations-container',
    ) as HTMLDivElement

    this.tfrLoggedInElements = document.querySelectorAll('.tfr-logged-in')
    this.tfrLoggedOutElements = document.querySelectorAll('.tfr-logged-out')
    this.tfrToggleOpenElements = document.querySelectorAll('.tfr-toggle-open')
    this.tfrToggleClosedElements = document.querySelectorAll('.tfr-toggle-closed')
  }


  private getSizeRecommendationState(): {
    selectedSku: string;
    availableSkus: string[];
  } {
    const activeButton = document.querySelector('.tfr-size-rec-select-button.active');
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

  private async tryOn(noCache: boolean = false): Promise<void> {
    if (!this.vtoComponent) {
      console.error('VtoComponent is not initialized')
      return
    }

    const { selectedSku, availableSkus } = this.getSizeRecommendationState()
    await this.getCachedOrNewVTO(selectedSku, availableSkus)

    const skipCache = noCache && this.hasAttemptedTryOn
    this.tfrShop.priorityTryOnWithMultiRequestCache(selectedSku, availableSkus, skipCache).then(priorityFrames => {
      this.vtoComponent.init()
      this.vtoComponent.onNewFramesReady(priorityFrames)
    }).catch(e => {
      console.error("failed to get frames", e)
    })
  }



  private bindEvents() {
    this.tfrSizeRecActionLogin.addEventListener('click', this.onSignInClick)
    this.tfrSizeRecActionLogout.addEventListener('click', this.onSignOutClick)
    this.tfrSizeRecSelect.addEventListener('click', this.onSizeRecSelectClick.bind(this))
    this.tfrSizeRecTitleToggle.addEventListener('click', this.toggletSizeRecSelectContainer.bind(this))
    this.tfrInfoIcon.addEventListener('click', this.onFitInfoClick)
    this.tfrLoginToView.addEventListener('click', this.onSignInClick)

    const tryOnButton = document.getElementById('tfr-try-on-button')
    if (!tryOnButton) return

    tryOnButton.addEventListener('click', async () => {
      if (!this.isLoggedIn) {
        this.onSignInClick()
        return
      }


      tryOnButton.classList.add('loading')
        ; (tryOnButton as HTMLButtonElement).disabled = true

      try {
        this.tryOn()
      } catch (error) {
        console.error('Error during try-on process:', error)
      } finally {
        tryOnButton.classList.remove('loading')
          ; (tryOnButton as HTMLButtonElement).disabled = false
      }
    })
  }

  private onSizeRecSelectClick(e: MouseEvent) {
    const target = e.target as HTMLDivElement
    if (!target.classList.contains('tfr-size-rec-select-button') || target.classList.contains('tfr-disabled')) return

    e.preventDefault()

    const selectedIndex = Number(target.getAttribute('data-index'))
    if (Number.isNaN(selectedIndex)) return

    const allButtons = document.querySelectorAll('.tfr-size-rec-select-button')

    allButtons.forEach((button) => button.classList.remove('active'))
    allButtons.item(selectedIndex).classList.add('active')

    this.redraw(selectedIndex)

    this.tryOn()
  }

  private async getCachedOrNewVTO(
    activeSku: string,
    availableSkus: string[]
  ): Promise<void> {
    const noCache = this.hasAttemptedTryOn && this.noCacheOnRetry;
    const vtoResults = await this.tfrShop.priorityTryOnWithMultiRequestCache(activeSku, availableSkus, noCache);

    if (this.vtoComponent && vtoResults.includes(activeSku)) {
      this.vtoComponent.init();
      this.vtoComponent.onNewFramesReady(activeSku);
    }
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

  private toggletSizeRecSelectContainer() {
    if (this.isCollapsed) {
      this.isCollapsed = false
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')
      this.tfrToggleOpenElements.forEach((element) => ((element as HTMLElement).style.display = 'block'))
      this.tfrToggleClosedElements.forEach((element) => ((element as HTMLElement).style.display = 'none'))
    } else {
      this.isCollapsed = true
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-down')
      this.tfrToggleOpenElements.forEach((element) => ((element as HTMLElement).style.display = 'none'))
      this.tfrToggleClosedElements.forEach((element) => ((element as HTMLElement).style.display = 'block'))
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
                    <div id="tfr-size-recommendations-container">
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
                        <div id="tfr-size-rec-select-container">
                          <div id="tfr-size-how-it-fits">Select size to see how it fits:</div>

                          <div id="tfr-size-rec-select"></div>

                          <div id="tfr-size-rec-subtitle">
                            How it fits
                            <span id="tfr-info-icon">${infoIcon}</span>
                          </div>

                          <div id="tfr-size-rec-table"></div>

                          <button id="tfr-try-on-button" class="tfr-try-on-button">Try On</button>
                        </div>
                      </div>

                      <div id="tfr-size-rec-action">
                        <div id="tfr-size-rec-action-login">Sign up or login</div>
                        <div id="tfr-size-rec-action-logout">Log out</div>
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
