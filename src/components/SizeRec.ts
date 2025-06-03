import { infoIcon, tfrDoor, userIcon } from './svgs'

export type RecommendedSize = {
  recommended: string
  sizes: {
    size: string
    size_id: number
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

  private isLoggedIn: boolean = false

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
    private readonly onTryOnClick: (styleId: number, sizeId: number, shouldDisplay: boolean) => Promise<void>,
  ) {
    this.init(sizeRecMainDivId)
  }

  public get sku() {
    return this._sku
  }

  public setSku(sku: string) {
    this._sku = sku
  }

  public get styleId() {
    return this._styleId
  }

  public setStyleId(styleId: number) {
    this._styleId = styleId
  }

  public setIsLoggedIn(isLoggedIn: boolean) {
    this.isLoggedIn = isLoggedIn

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

  public setGarmentLocations(locations: string[]) {
    if (!locations || !locations.length) {
      this.tfrSizeRecTitle.style.display = 'none'

      return
    }

    this.renderGarmentLocations(locations)
  }

  public setRecommendedSize({ recommended, sizes }: RecommendedSize) {
    this.renderSizeRec(recommended, sizes)
  }

  public setError() {
    this.tfrSizeRecTitle.style.display = 'none'

    if (!this.isLoggedIn) return

    this.tfrSizeRecommendationError.style.display = 'block'
    this.tfrSizeRecommendationError.innerHTML = 'No recommended size found.'
  }

  private init(sizeRecMainDivId: string) {
    const sizeRecMainDiv = document.getElementById(sizeRecMainDivId) as HTMLDivElement

    if (!sizeRecMainDiv) throw new Error('Size rec main div not found')

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
      // Prevent multiple clicks while loading
      if (tryOnButton.classList.contains('loading')) {
        return
      }

      const activeButton = document.querySelector('.tfr-size-rec-select-button.active')
      if (!activeButton) return

      const selectedSizeId = Number(activeButton.getAttribute('data-size-id'))
      if (Number.isNaN(selectedSizeId)) return

      // Set loading state
      tryOnButton.classList.add('loading')
      const originalText = tryOnButton.textContent
      tryOnButton.textContent = ' '
      tryOnButton.setAttribute('disabled', 'true')

      try {
        // Get all size buttons
        const allSizeButtons = Array.from(document.querySelectorAll('.tfr-size-rec-select-button')) as HTMLElement[];
        const activeIndex = allSizeButtons.indexOf(activeButton as HTMLElement);

        // 1. Fetch and display the VTO for the active (recommended) size
        if (this.styleId !== null && !Number.isNaN(selectedSizeId)) {
          try {
            await this.onTryOnClick(this.styleId, selectedSizeId, true);
          } catch (e) {
            console.error(`Error trying on active size ${selectedSizeId}:`, e);
            // Optionally, inform the user about the error for the primary VTO
          }
        }

        // 2. Fetch VTO for the size to the left (if it exists)
        if (this.styleId !== null && activeIndex > 0) {
          const leftButton = allSizeButtons[activeIndex - 1];
          const leftSizeId = Number(leftButton.getAttribute('data-size-id'));
          if (!Number.isNaN(leftSizeId)) {
            try {
              await this.onTryOnClick(this.styleId, leftSizeId, false);
            } catch (e) {
              console.error(`Error pre-loading try-on for left size ${leftSizeId}:`, e);
            }
          }
        }

        // 3. Fetch VTO for the size to the right (if it exists)
        if (this.styleId !== null && activeIndex >= 0 && activeIndex < allSizeButtons.length - 1) {
          const rightButton = allSizeButtons[activeIndex + 1];
          const rightSizeId = Number(rightButton.getAttribute('data-size-id'));
          if (!Number.isNaN(rightSizeId)) {
            try {
              await this.onTryOnClick(this.styleId, rightSizeId, false);
            } catch (e) {
              console.error(`Error pre-loading try-on for right size ${rightSizeId}:`, e);
            }
          }
        }
      } catch (error) {
        console.error('Error during sequential try-on process:', error);
      } finally {
        // Reset loading state
        tryOnButton.classList.remove('loading')
        tryOnButton.textContent = originalText
        tryOnButton.removeAttribute('disabled')
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

    const selectedSizeId = Number(target.getAttribute('data-size-id'))
    if (Number.isNaN(selectedSizeId)) return

    this.onTryOnClick(this.styleId, selectedSizeId, true)
  }

  private renderSizeRec(recommended: string, sizes: RecommendedSize['sizes']) {
    this.tfrSizeRecSize.innerHTML = `&nbsp;${recommended}`

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
          `<div class="tfr-size-rec-select-button ${i === index ? 'active' : ''}" data-index="${i}" data-size-id="${
            sizes[i].size_id
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

                          <div id="tfr-try-on-button" class="tfr-try-on-button">Try On</div>
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
