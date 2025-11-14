import { InitImageSlider } from './virtualTryOnSlider'

export class VtoComponent {
  private isInit = false
  private isShown = false
  private currentSliderValue: number = 0
  private slider: ReturnType<typeof InitImageSlider> = null
  private vtoMainDiv: HTMLElement | null = null
  private tryOnImage: HTMLImageElement | null = null
  private sliderElement: HTMLInputElement | null = null

  constructor(private readonly vtoMainDivId: string) { }

  public init() {
    if (this.isInit) return

    this.vtoMainDiv = document.getElementById(this.vtoMainDivId)

    if (!this.vtoMainDiv) {
      const newDiv = document.createElement('div')
      newDiv.id = this.vtoMainDivId
      newDiv.style.display = 'none'  // Initially hidden
      document.body.appendChild(newDiv)
      this.vtoMainDiv = newDiv
    }

    this.isInit = true
    console.log('VTO Component initialized successfully')
  }

  public show() {
    if (this.isShown) return
    if (!this.isInit) this.init()

    const targetDiv = this.vtoMainDiv!

    targetDiv.innerHTML = `
        <div class="tfr-slider-wrapper">
          <img id="tfr-tryon-image" src="" style="max-width: 30vw; display: block;" />
          <input type="range" id="tfr-slider" />
        </div>
    `

    targetDiv.style.display = 'block'
    targetDiv.style.visibility = 'visible'

    this.tryOnImage = targetDiv.querySelector('#tfr-tryon-image') as HTMLImageElement
    this.sliderElement = targetDiv.querySelector('#tfr-slider') as HTMLInputElement

    const onChange = (slider, imageUrl) => {
      this.tryOnImage!.src = imageUrl
      this.currentSliderValue = parseInt(slider.value)
    }

    this.slider = InitImageSlider('tfr-slider', onChange)
    this.isShown = true
  }

  public hide() {
    if (!this.isShown) return

    const targetDiv = this.vtoMainDiv!

    targetDiv.style.display = 'none'
    targetDiv.innerHTML = ''

    this.slider = null
    this.tryOnImage = null
    this.sliderElement = null

    this.isShown = false
  }

  public onNewFramesReady(frames: string[]) {
    if (!this.isShown) {
      this.show()
    }

    if (Array.isArray(frames) && frames.length > 0) {
      const boundedValue = Math.min(this.currentSliderValue, frames.length - 1)
      const e = this.slider.Load(frames, boundedValue)
      if (e instanceof Error) {
        console.error(e)
        return
      }

      if (this.sliderElement && this.currentSliderValue < frames.length) {
        this.sliderElement.value = this.currentSliderValue.toString()
        this.tryOnImage!.src = frames[this.currentSliderValue]
      }
    }
  }
}
