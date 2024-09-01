const loginIconSrc = 'https://assets.dev.thefittingroom.xyz/shop-sdk/assets/login-icon.svg'
const doorLogoSrc = 'https://assets.dev.thefittingroom.xyz/shop-sdk/assets/tfr-door-brand.svg'

export type RecommendedSize = {
  recommended: string
  sizes: {
    size: string
    locations: {
      fit: string
      isPerfect: boolean
      location: string
    }[]
  }[]
}

export class SizeRecComponent {
  private _sku: string = ''

  private isLoggedIn: boolean = false

  private tfrSizeHowItFits: HTMLDivElement
  private tfrSizeRecTitle: HTMLDivElement
  private tfrSizeRecSubtitle: HTMLDivElement
  private tfrSizeRecActionLogin: HTMLDivElement
  private tfrSizeRecActionLogout: HTMLDivElement
  private tfrSizeRecLoading: HTMLDivElement
  private tfrSizeRecommendationError: HTMLDivElement
  private tfrSizeRecommendationsContainer: HTMLDivElement
  private tfrSizeRecSelect: HTMLDivElement
  private tfrSizeRecSize: HTMLDivElement
  private tfrSizeRecTable: HTMLDivElement
  private tfrSizeRecTitleToggle: HTMLDivElement
  private tfrSizeRecSelectContainer: HTMLDivElement

  private isCollapsed: boolean = false
  private redraw: (index: number) => void = null

  constructor(
    sizeRecMainDivId: string,
    private readonly onSignInClick: () => void,
    private readonly onSignOutClick: () => void,
  ) {
    this.init(sizeRecMainDivId)
  }

  public get sku() {
    return this._sku
  }

  public setSku(sku: string) {
    this._sku = sku
  }

  public setIsLoggedIn(isLoggedIn: boolean) {
    this.isLoggedIn = isLoggedIn

    this.tfrSizeRecSelectContainer.style.display = 'flex'

    if (isLoggedIn) {
      this.tfrSizeRecActionLogin.style.display = 'none'
      this.tfrSizeRecActionLogout.style.display = 'block'
      this.tfrSizeRecTitle.style.display = 'flex'
      this.tfrSizeRecSubtitle.style.display = 'block'
      this.isCollapsed = false
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')
      this.tfrSizeHowItFits.style.display = 'block'
    } else {
      this.tfrSizeRecActionLogin.style.display = 'block'
      this.tfrSizeRecActionLogout.style.display = 'none'

      this.tfrSizeRecTitle.style.display = 'flex'
      this.tfrSizeRecSubtitle.style.display = 'block'
      this.tfrSizeRecommendationError.style.display = 'none'
      this.tfrSizeRecommendationError.innerHTML = ''
      this.tfrSizeHowItFits.style.display = 'none'
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
      this.tfrSizeRecSubtitle.style.display = 'none'

      return
    }

    this.renderGarmentLocations(locations)
    this.tfrSizeRecSelect.style.display = 'none'
  }

  public setRecommendedSize({ recommended, sizes }: RecommendedSize) {
    this.renderSizeRec(recommended, sizes)
    this.tfrSizeRecSelect.style.display = 'flex'
  }

  public setError() {
    this.tfrSizeRecTitle.style.display = 'none'
    this.tfrSizeRecSubtitle.style.display = 'none'

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
    this.tfrSizeRecSubtitle = document.getElementById('tfr-size-rec-subtitle') as HTMLDivElement

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
  }

  private bindEvents() {
    this.tfrSizeRecActionLogin.addEventListener('click', this.onSignInClick)
    this.tfrSizeRecActionLogout.addEventListener('click', this.onSignOutClick)
    this.tfrSizeRecSelect.addEventListener('click', this.onSizeRecSelectClick.bind(this))
    this.tfrSizeRecTitleToggle.addEventListener('click', this.toggletSizeRecSelectContainer.bind(this))
  }

  private onSizeRecSelectClick(e: MouseEvent) {
    const target = e.target as HTMLDivElement
    if (!target.classList.contains('tfr-size-rec-select-button')) return

    e.preventDefault()

    const selectedIndex = Number(target.getAttribute('data-index'))
    if (Number.isNaN(selectedIndex)) return

    const allButtons = document.querySelectorAll('.tfr-size-rec-select-button')

    allButtons.forEach((button) => button.classList.remove('active'))
    allButtons.item(selectedIndex).classList.add('active')

    this.redraw(selectedIndex)
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
          `<div class="tfr-size-rec-select-button ${i === index ? 'active' : ''}" data-index="${i}">${name}</div>`,
      )
      .join('')

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

  private renderLoginCta() {
    return `<div class="tfr-size-rec-login-cta"><img src="${loginIconSrc}" /> Sign up or login to view</div>`
  }

  private renderGarmentLocations(locations: string[]) {
    const html = locations.map((location) => this.renderSizeRecTableRow(location, this.renderLoginCta())).join('')

    this.tfrSizeRecTable.innerHTML = html
    this.tfrSizeRecSize.innerHTML = this.renderLoginCta()
  }

  private toggletSizeRecSelectContainer() {
    if (this.isCollapsed) {
      this.isCollapsed = false
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-down')
      this.tfrSizeRecSelectContainer.style.display = 'flex'
    } else {
      this.isCollapsed = true
      this.tfrSizeRecTitleToggle.classList.remove('tfr-chevron-up')
      this.tfrSizeRecTitleToggle.classList.add('tfr-chevron-down')
      this.tfrSizeRecSelectContainer.style.display = 'none'
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

                      <div id="tfr-size-rec-title">
                        Recommended Size:
                        <div id="tfr-size-rec-size">
                          <div class="tfr-size-rec-login-cta">
                            <img  src="${loginIconSrc}" /> Sign up or login to view
                          </div>
                        </div>
                      </div>

                      <div id="tfr-size-rec-select-container">
                        <div id="tfr-size-how-it-fits">Select size to see how it fits:</div>

                        <div id="tfr-size-rec-select"></div>
                        
                        <div id="tfr-size-rec-subtitle">How it fits</div>
                        
                        <div id="tfr-size-rec-table"></div>
                      </div>
                      
                      <div id="tfr-size-rec-action">
                        <div id="tfr-size-rec-action-login">Sign up or login</div>
                        <div id="tfr-size-rec-action-logout">Log out</div>
                      </div>

                      <div class="tfr-powered-by">
                        <div>Powered by</div>
                        <div class="tfr-powered-by-logo"><img src="${doorLogoSrc}" /></div>
                        <div class="tfr-powered-by-text-bold">The Fitting Room</div>
                      </div>
                    </div>
                  </div>
                  <div id="tfr-size-recommendation-error"></div>`

    sizeRecMainDiv.innerHTML = body
  }
}
